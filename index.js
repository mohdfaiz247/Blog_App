require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const mongoose = require("mongoose");

const userRoute = require("./routes/user");
const blogRoute = require("./routes/blog");
const {checkForAuthenticationCookie} = require("./middleware/authentication");
const Blog = require("./models/blog");

const app = express();
const PORT = process.env.PORT || 8000;

mongoose.connect(process.env.MONGO_URL)
        .then(e => console.log("MongoDB is Connected"));

app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));

app.use(express.urlencoded({extended: false}));
app.use(cookieParser())
app.use(checkForAuthenticationCookie("token"))
app.use(express.static(path.resolve("./public")));

app.get("/", async (req, res) => {
    let query = {};
    if (req.query.search) {
        query = { title: { $regex: req.query.search, $options: "i" } };
    }
    let allBlogs = await Blog.find(query).populate("createdBy");
    
    if (req.query.sort === "likes") {
        allBlogs.sort((a, b) => {
            const aLikes = a.likes ? a.likes.length : 0;
            const bLikes = b.likes ? b.likes.length : 0;
            return bLikes - aLikes;
        });
    } else if (req.query.sort === "trending") {
        allBlogs.sort((a, b) => {
            const aScore = (a.views || 0) * (a.likes ? a.likes.length : 0);
            const bScore = (b.views || 0) * (b.likes ? b.likes.length : 0);
            return bScore - aScore;
        });
    } else {
        allBlogs.sort((a, b) => b.createdAt - a.createdAt);
    }

    return res.render("home", {
        user: req.user,
        blogs: allBlogs,
        currentSort: req.query.sort || "recent",
        searchQuery: req.query.search || ""
    });
})

app.use("/user", userRoute);
app.use("/blog", blogRoute);


app.listen(PORT, () => console.log(`Server is running at PORT: ${PORT}`));