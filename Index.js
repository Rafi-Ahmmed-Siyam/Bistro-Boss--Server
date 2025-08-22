require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 9000;

// Middlewares
app.use(express.json());
app.use(
   cors({
      origin: ['http://localhost:3000', 'http://192.168.0.102:3000'],
   })
);

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const req = require('express/lib/request');
const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.wsg3r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
   },
});
async function run() {
   try {
      const userCollection = client
         .db('BistroBoss_Collection')
         .collection('users');
      const menuCollection = client
         .db('BistroBoss_Collection')
         .collection('menu');
      const reviewCollection = client
         .db('BistroBoss_Collection')
         .collection('reviews');
      const cartCollection = client
         .db('BistroBoss_Collection')
         .collection('carts');

      // Custom Middlewares
      const verifyToken = (req, res, next) => {
         // console.log(req.headers.authorization);
         if (!req.headers.authorization) {
            return res.status(401).send({ message: 'Unauthorized Access' });
         }
         const token = req.headers.authorization.split(' ')[1];
         // console.log(token);
         jwt.verify(token, process.env.JWT_SECRET, (error, decode) => {
            if (error) {
               return res.status(401).send({ message: 'Unauthorized Access' });
            }
            req.userInfoJwt = decode;
            // console.log(decode.email);

            next();
         });
      };

      const verifyEmail = (req, res, next) => {
         const emailByJwt = req?.userInfoJwt?.email;
         const emailByParams = req?.params?.email;
         const emailByBody = req?.body?.email;
         // console.log(emailByBody, emailByParams);
         if (
            (emailByParams && emailByJwt !== emailByParams) ||
            (emailByBody && emailByJwt !== emailByBody)
         ) {
            return res.status(403).send({ message: 'Forbidden Access' });
         } else {
            next();
         }
      };

      const verifyAdmin = async (req, res, next) => {
         const emailByJwt = req?.userInfoJwt?.email;
         // console.log('veryfy email', emailByJwt);
         const query = { userEmail: emailByJwt };
         const user = await userCollection.findOne(query);
         const isAdmin = user?.role === 'admin';
         if (!isAdmin) {
            return res
               .status(403)
               .send({ message: 'Forbidden Access not admin' });
         }
         next();
      };

      //JWT Related Api-------------------------------->

      app.post('/jwt', async (req, res) => {
         const user = req.body;

         const token = jwt.sign(user, process.env.JWT_SECRET, {
            expiresIn: '1d',
         });
         res.send({ token });
      });

      //User Related Apis-------------------------------->

      // When a user signIn check is the user is admin
      app.get(
         '/user/admin/:email',
         verifyToken,
         verifyEmail,
         async (req, res) => {
            const email = req.params.email;

            const query = {
               userEmail: email,
            };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
               admin = user?.role === 'admin';
            }
            res.send({ admin });
         }
      );

      // TODO: Admin Check
      // Get user data
      app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
         // console.log(req.headers.authorization);
         const result = await userCollection.find().toArray();
         res.send(result);
      });

      // Add user data in database
      app.post('/users', async (req, res) => {
         const user = req.body;
         const { userName, userEmail } = user;

         const query = { userEmail };
         const isExists = await userCollection.findOne(query);
         if (isExists) {
            return res.send({ message: 'User is already exists' });
         }
         const result = await userCollection.insertOne(user);
         res.send(result);
      });

      // TODO: Admin Check
      // Delete user
      app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
         const id = req.params.id;
         const query = { _id: new ObjectId(id) };

         const result = await userCollection.deleteOne(query);
         res.send(result);
      });

      // TODO: Admin Check
      // Set a user as an Admin
      app.patch(
         '/users/admin/:id',
         verifyToken,
         verifyAdmin,
         async (req, res) => {
            const id = req.params.id;

            const filter = { _id: new ObjectId(id) };
            const update = {
               $set: {
                  role: 'admin',
               },
            };

            const result = await userCollection.updateOne(filter, update);
            res.send(result);
         }
      );

      // MENU Related APis----------------------------->>>>>
      // Get all menu data
      app.get('/menu', async (req, res) => {
         const result = await menuCollection.find().toArray();
         res.send(result);
      });

      // Get all reviews data
      app.get('/reviews', async (req, res) => {
         const result = await reviewCollection.find().toArray();
         res.send(result);
      });

      //Add cart data
      app.post('/carts', verifyToken, verifyEmail, async (req, res) => {
         const cartItem = req.body;
         const { menuId, email } = cartItem;

         const isExist = await cartCollection.findOne({ menuId, email });
         if (isExist) {
            let menuId = cartItem?.menuId;
            let email = cartItem?.email;
            const filter = { menuId, email };
            const update = {
               $inc: { quantity: 1 },
            };
            const updateResult = await cartCollection.updateOne(filter, update);
            return res
               .status(200)
               .send({ updateResult, message: 'Quantity updated!' });
         }

         const result = await cartCollection.insertOne(cartItem);
         res.status(201).send({ result, message: 'Item added to cart!' });
      });

      //Delete Cart,update quantity count,decrease quantity count
      app.patch('/carts/update', verifyToken, verifyEmail, async (req, res) => {
         const data = req.body;
         const { itemId, email, number } = data;
         const query = { _id: new ObjectId(itemId) };
         const increaseQuantity = { $inc: { quantity: 1 } };
         const decreaseQuantity = { $inc: { quantity: -1 } };

         if (number === 0) {
            const result = await cartCollection.deleteOne(query);
            res.send({
               result,
               message:
                  'The item has been successfully deleted from your cart!',
            });
         } else if (number === 1) {
            const result = await cartCollection.updateOne(
               query,
               increaseQuantity
            );
            res.send({
               result,
               message: 'Quantity Increase',
            });
         } else if (number === -1) {
            const result = await cartCollection.updateOne(
               query,
               decreaseQuantity
            );
            res.send({
               result,
               message: 'Quantity Decrease',
            });
         } else {
            res.send({ message: 'No cart item found to update' });
         }
      });

      // Get cart data by user email
      app.get('/carts/:email', verifyToken, verifyEmail, async (req, res) => {
         const email = req.params.email;
         const filter = { email: email };
         const result = await cartCollection.find(filter).toArray();
         res.send(result);
      });

      // Read data by food Category
      app.get('/menu/:category', async (req, res) => {
         const category = req.params.category;
         const page = parseInt(req.query.page);
         const limit = parseInt(req.query.limit);

         const skip = page * limit;

         const query = { category: category };
         const result = await menuCollection
            .find(query)
            .skip(skip)
            .limit(limit)
            .toArray();
         res.send(result);
      });

      // get menu total count
      app.get('/totalMenuCount/:category', async (req, res) => {
         const category = req.params.category;

         const query = { category: category };
         const count = await menuCollection.countDocuments(query);
         res.send({ count });
      });

      // await client.connect();
      // await client.db("admin").command({ ping: 1 });
      console.log(
         'Pinged your deployment. You successfully connected to MongoDB!'
      );
   } finally {
      // Ensures that the client will close when you finish/error
      // await client.close();
   }
}
run().catch(console.dir);

app.get('/', (req, res) => {
   res.send('This server is for bistro boss restaurant');
});

app.listen(port, () => {
   console.log(`My server is now running in port ${port}`);
});
