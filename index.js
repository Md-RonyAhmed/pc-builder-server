require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

const corsConfig = {
  origin: true,
  credentials: true,
};

app.use(cors(corsConfig));
app.options("*", cors(corsConfig));

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
    const userCollection = db.collection("users");
    const ordersCollection = db.collection("orders");
    const profileCollection = db.collection("userProfile");
    const reviewsCollection = db.collection("reviews");
    const categoryCollection = db.collection("categories");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "6h",
      });
      res.send({ token });
    });

    function verifyToken(req, res, next) {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = authHeader.split(" ")[1];
      jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET,
        function (err, decoded) {
          if (err) {
            return res.status(403).send({ message: "Forbidden access" });
          }
          req.decoded = decoded;
          next();
        }
      );
    }

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // users related api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

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
        const totalProducts = await productCollection.countDocuments(
          searchQuery
        );

        // Get paginated and searched products
        const products = await productCollection
          .find(searchQuery)
          .sort({ $natural: -1 }) // Sort by newest first
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
              productsPerPage: limit,
            },
          });
        }

        res.send({
          status: true,
          data: products,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts,
            productsPerPage: limit,
          },
        });
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).send({
          status: false,
          error: "Internal Server Error",
        });
      }
    });

    app.get("/productsCount", async (req, res) => {
      const count = await productCollection.estimatedDocumentCount();
      res.send({ count });
    });

    app.post("/products", async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
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
          ...(search ? { name: { $regex: search, $options: "i" } } : {}),
        };

        // Get total count for pagination
        const totalProducts = await productCollection.countDocuments(query);

        // Get paginated products
        const products = await productCollection
          .find(query)
          .sort({ $natural: -1 }) // Sort by newest first
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
              productsPerPage: limit,
            },
          });
        }

        res.send({
          status: true,
          data: products,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts,
            productsPerPage: limit,
          },
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

    app.delete("/product/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const result = await productCollection.deleteOne({
        _id: id,
      });
      // console.log(result);
      res.send(result);
    });

    //post place orders
    app.post("/orders", verifyToken, async (req, res) => {
      try {
        const orders = req.body;
        const result = await ordersCollection.insertOne(orders);

        // Get the order with _id from MongoDB
        const insertedOrder = await ordersCollection.findOne({
          _id: result.insertedId,
        });

        res.send({
          success: true,
          message: "Order placed Successfully",
          order: insertedOrder, // এখানে পুরো অর্ডার অবজেক্ট পাঠাচ্ছি যেখানে _id থাকবে
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: "Failed to place order",
          error: error.message,
        });
      }
    });

    // users related api
    app.get("/category", async (req, res) => {
      const result = await categoryCollection.find().toArray();
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
