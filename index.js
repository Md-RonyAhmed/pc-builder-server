require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

const cors = require("cors");

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@tech-net.wrygwyk.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    const db = client.db("sunnah-store");
    console.log("DB connection established");
    const productCollection = db.collection("products");

    app.get("/products", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";

        // Create search query
        const searchQuery = search 
          ? { name: { $regex: search, $options: "i" } }
          : {};

        // Get total count for pagination with search
        const totalProducts = await productCollection.countDocuments(searchQuery);

        // Get paginated and searched products
        const products = await productCollection
          .find(searchQuery)
          .sort({ createdAt: -1 }) // Sort by newest first
          .skip(skip)
          .limit(limit)
          .toArray();

        if (!products?.length) {
          return res.send({
            status: false,
            error: "No products found",
            data: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              totalProducts: 0,
              productsPerPage: limit
            }
          });
        }

        res.send({
          status: true,
          data: products,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts,
            productsPerPage: limit
          }
        });
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).send({
          status: false,
          error: "Internal Server Error"
        });
      }
    });

    app.get('/productsCount', async (req, res) => {
      const count = await productCollection.estimatedDocumentCount();
      res.send({ count });
    })

    app.post("/products", async (req, res) => {
      const product = req.body;

      const result = await productCollection.insertMany(product);

      res.send(result);
    });

    app.get("/products/:category*", async (req, res) => {
      try {
        const { category } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";

        const decodedCategory = decodeURIComponent(category);
        const regexCategory = new RegExp(decodedCategory, "i");

        // Create combined query for category and search
        const query = {
          category: regexCategory,
          ...(search ? { name: { $regex: search, $options: "i" } } : {})
        };

        // Get total count for pagination
        const totalProducts = await productCollection.countDocuments(query);

        // Get paginated products
        const products = await productCollection
          .find(query)
          .sort({ createdAt: -1 }) // Sort by newest first
          .skip(skip)
          .limit(limit)
          .toArray();

        if (!products?.length) {
          return res.send({
            status: false,
            error: "No products found",
            data: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              totalProducts: 0,
              productsPerPage: limit
            }
          });
        }

        res.send({
          status: true,
          data: products,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts,
            productsPerPage: limit
          }
        });
      } catch (error) {
        res.status(500).send({ status: false, error: "Internal server error" });
      }
    });

    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;

      const result = await productCollection.findOne({
        _id: id,
      });
      res.send(result);
    });

    app.delete("/product/:id", async (req, res) => {
      const id = req.params.id;

      const result = await productCollection.deleteOne({
        _id: id,
      });
      // console.log(result);
      res.send(result);
    });

    app.post("/comment/:id", async (req, res) => {
      const productId = req.params.id;
      const comment = req.body.comment;

      // console.log(productId);
      // console.log(comment);

      const result = await productCollection.updateOne(
        { _id: productId },
        { $push: { comments: comment } }
      );

      // console.log(result);

      if (result.modifiedCount !== 1) {
        // console.error('Product not found or comment not added');
        res.json({
          error: "Product not found or comment not added",
        });
        return;
      }

      // console.log('Comment added successfully');
      res.json({ message: "Comment added successfully" });
    });

    app.get("/comment/:id", async (req, res) => {
      const productId = req.params.id;

      const result = await productCollection.findOne(
        { _id: productId },
        { projection: { _id: 0, comments: 1 } }
      );

      if (result) {
        res.json(result);
      } else {
        res.status(404).json({ error: "Product not found" });
      }
    });

    app.post("/user", async (req, res) => {
      const user = req.body;

      const result = await userCollection.insertOne(user);

      res.send(result);
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;

      const result = await userCollection.findOne({ email });

      if (result?.email) {
        return res.send({ status: true, data: result });
      }

      res.send({ status: false });
    });
  } finally {
  }
};

run().catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("Welcome to PC-builder server!");
});

app.listen(port, () => {
  console.log(`PC-builder server listening on port ${port}`);
});
