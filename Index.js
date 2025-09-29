require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 8000;

// Middlewares
app.use(
   cors({
      origin: [
         'http://localhost:3000',
         'https://vercel.com/rafi-ahmmeds-projects/bistro-boss-client/7ivCR7ViuvJonKg2f2xyVoesPB2r',
         'https://bistro-boss-client-levu62g5h-rafi-ahmmeds-projects.vercel.app',
         'https://bistro-boss-client-gamma.vercel.app',
      ],
   })
);
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const req = require('express/lib/request');
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
      const paymentsCollection = client
         .db('BistroBoss_Collection')
         .collection('payments');

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
         // console.log('verify email', emailByJwt);
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

      // Delete user
      app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
         const id = req.params.id;
         const query = { _id: new ObjectId(id) };

         const result = await userCollection.deleteOne(query);
         res.send(result);
      });

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

      // Get a item data
      app.get('/menu/:id', async (req, res) => {
         const id = req.params.id;
         const query = { _id: new ObjectId(id) };
         const result = await menuCollection.findOne(query);
         res.send(result);
      });

      // Add menu in menu Collection
      app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
         const menuItem = req.body;
         // console.log(menuItem);
         const result = await menuCollection.insertOne(menuItem);
         res.send(result);
      });

      // Update a menu item
      app.patch('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
         const id = req.params.id;
         const updatedData = req.body;
         console.log(id, updatedData);
         const filter = { _id: new ObjectId(id) };
         const updatedDoc = {
            $set: updatedData,
         };
         const result = await menuCollection.updateOne(filter, updatedDoc);
         res.send(result);
      });

      // Delete a menu item
      app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
         const id = req.params.id;
         const query = { _id: new ObjectId(id) };
         const result = await menuCollection.deleteOne(query);
         res.send(result);
      });

      // Get all reviews data
      app.get('/reviews', async (req, res) => {
         const result = await reviewCollection.find().toArray();
         res.send(result);
      });

      //Cart Related APIs----------------------->
      // Payment  PaymentIntent------------->
      app.post('/create/create-payment-intent', async (req, res) => {
         const { price } = req.body;
         const amount = parseInt(price * 100);
         // console.log('price', price);
         // console.log('amount', amount);

         const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method_types: ['card', 'link'],
         });

         res.send({ clientSecret: paymentIntent.client_secret });
      });

      // Add payment data in database and delete user cart data from card collection
      app.post('/payments', async (req, res) => {
         const paymentData = req.body;
         // console.log(paymentData);
         const paymentResult = await paymentsCollection.insertOne(paymentData);

         // carefully delete items in card collection
         const query = {
            _id: {
               $in: paymentData.cartId.map((id) => new ObjectId(id)),
            },
         };

         const deleteResult = await cartCollection.deleteMany(query);

         res.send({ paymentResult, deleteResult });
      });

      // Get payment data
      app.get(
         '/payments/:email',
         verifyToken,
         verifyEmail,
         async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const options = { sort: { data: -1 } };
            const result = await paymentsCollection
               .find(query, options)
               .toArray();
            res.send(result);
         }
      );

      // TODO: Get All payments data for admin panel

      // Add to user cart data
      app.post('/carts', verifyToken, verifyEmail, async (req, res) => {
         const cartItem = req.body;
         const { menuId, email } = cartItem;

         // const isExist = await cartCollection.findOne({ menuId, email });
         // if (isExist) {
         //    let menuId = cartItem?.menuId;
         //    let email = cartItem?.email;
         //    const filter = { menuId, email };
         //    const update = {
         //       $inc: { quantity: 1 },
         //    };
         //    const updateResult = await cartCollection.updateOne(filter, update);
         //    return res
         //       .status(200)
         //       .send({ updateResult, message: 'Quantity updated!' });
         // }

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

      // Read data by food Category------->{Pagination}
      app.get('/menu/category/:category', async (req, res) => {
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

      // Stats or analytics for Admin
      app.get('/admin-stats', verifyToken, verifyToken, async (req, res) => {
         const users = await userCollection.estimatedDocumentCount();
         const menuItems = await menuCollection.estimatedDocumentCount();
         const orders = await paymentsCollection.estimatedDocumentCount();

         // This is not the best way
         // const payment = await paymentsCollection.find().toArray();
         // const revenue = payment.reduce(
         //    (total, payment) => total + payment.price,
         //    0
         // );

         // Best Way
         const result = await paymentsCollection
            .aggregate([
               {
                  $group: {
                     _id: null,
                     totalRevenue: { $sum: '$price' },
                  },
               },
            ])
            .toArray();
         // console.log(result[0].totalRevenue);
         const revenue = result[0]?.totalRevenue || 0;

         res.send({ users, menuItems, orders, revenue });
      });

      // Order and category stats
      app.get('/order-stats', async (req, res) => {
         const result = await paymentsCollection
            .aggregate([
               {
                  $unwind: '$menuItemId',
               },
               {
                  $addFields: {
                     menuItemId: { $toObjectId: '$menuItemId' },
                  },
               },
               {
                  $lookup: {
                     from: 'menu',
                     localField: 'menuItemId',
                     foreignField: '_id',
                     as: 'menuItem',
                  },
               },
               {
                  $unwind: '$menuItem',
               },
               {
                  $match: {
                     'menuItem.category': {
                        $in: ['dessert', 'drinks', 'salad', 'pizza', 'soup'],
                     },
                  },
               },
               {
                  $group: {
                     _id: '$menuItem.category',
                     quantity: {
                        $sum: 1,
                     },
                     totalRevenue: {
                        $sum: '$menuItem.price',
                     },
                  },
               },
               {
                  $project: {
                     _id: 0,
                     category: '$_id',
                     quantity: '$quantity',
                     revenue: '$totalRevenue',
                  },
               },
            ])
            .toArray();

         res.send(result);
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
