require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
		const db = client.db("pc-builder");
		console.log("DB connection established");
		const productCollection = db.collection("products");

		app.get("/products", async (req, res) => {
			const cursor = productCollection.find({});
			const product = await cursor.toArray();

			res.send({ status: true, data: product });
		});

		app.post("/products", async (req, res) => {
			const product = req.body;

			const result = await productCollection.insertMany(product);

			res.send(result);
		});


		app.get("/products/:category*", async (req, res) => {
			const { category } = req.params;
			const decodedCategory = decodeURIComponent(category);
			const regexCategory = new RegExp(decodedCategory, "i");

			const cursor = await productCollection.find({
				category: regexCategory,
			});
			const products = await cursor.toArray();

			res.send({ status: true, data: products });
		});


		app.get("/product/:id", async (req, res) => {
			const id = req.params.id;

			const result = await productCollection.findOne({
				_id: ObjectId(id),
			});
			res.send(result);
		});

		app.delete("/product/:id", async (req, res) => {
			const id = req.params.id;

			const result = await productCollection.deleteOne({
				_id: ObjectId(id),
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
				{ _id: ObjectId(productId) },
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
				{ _id: ObjectId(productId) },
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
