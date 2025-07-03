require('dotenv').config()
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 9000;


// Middleware
app.use(cors())
app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.wsg3r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
   }
});
async function run() {
   try {

      const menuCollection = client.db("BistroBoss_Collection").collection("menu");
      const reviewCollection = client.db("BistroBoss_Collection").collection("reviews");

      // Get all menu data
      app.get('/menu', async (req, res) => {

         const result = await menuCollection.find().toArray();
         res.send(result);
      })

      // Get all reviews data
      app.get('/reviews', async (req, res) => {

         const result = await reviewCollection.find().toArray()
         res.send(result);
      })

      // Read data by food Category
      app.get('/menu/:category', async (req, res) => {
         const category = req.params.category;
         const page = parseInt(req.query.page);
         const limit = parseInt(req.query.limit);

         const skip = (page * limit)


         const query = { category: category }
         const result = await menuCollection.find(query)
            .skip(skip)
            .limit(limit)
            .toArray();
         res.send(result)
      })

      // get menu total count
      app.get('/totalMenuCount/:category', async (req, res) => {
         const category = req.params.category;


         const query = { category: category };
         const count = await menuCollection.countDocuments(query);
         res.send({ count });
      })

      // await client.connect();
      // await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
   } finally {
      // Ensures that the client will close when you finish/error
      // await client.close();
   }
}
run().catch(console.dir);

app.get('/', (req, res) => {
   res.send("This server is for bistro boss resturent")
});

app.listen(port, () => {
   console.log(`My server is now running in port ${port}`)
})
