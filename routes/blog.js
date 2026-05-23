const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Blog = require("../models/blog");
const Comment = require("../models/comment");
const { marked } = require("marked");

const router = Router();


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.resolve(`./public/uploads/${req.user._id}`);
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const fileName = `${Date.now()}-${file.originalname}`
        cb(null, fileName);
    }
});

const upload = multer({ storage: storage })

router.get("/add-new", (req, res) => {
    return res.render("addBlog", {
        user: req.user
    })
})

router.post("/", upload.single("coverImage"), async (req, res) => {
    const {title, content} = req.body;
    const blogData = {
        body: content,
        title, 
        createdBy: req.user._id,
    };
    if (req.file) {
        blogData.coverImageURL = `/uploads/${req.user._id}/${req.file.filename}`;
    }
    const blog = await Blog.create(blogData);
    return res.redirect(`/blog/${blog._id}`);
})

router.get("/my-blogs", async (req, res) => {
    if (!req.user) return res.redirect("/user/signin");
    const blogs = await Blog.find({ createdBy: req.user._id }).sort({ createdAt: -1 }).populate("createdBy");
    return res.render("myBlogs", {
        user: req.user,
        blogs
    });
});

router.post("/like/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).json({ error: "Blog not found" });

        let liked = false;
        const hasLiked = blog.likes.includes(req.user._id);
        if (hasLiked) {
            blog.likes.pull(req.user._id);
        } else {
            blog.likes.push(req.user._id);
            liked = true;
        }
        await blog.save();
        return res.json({ success: true, likesCount: blog.likes.length, liked });
    } catch (error) {
        console.error("Like error:", error);
        return res.status(500).json({ error: "Server error" });
    }
});

router.get("/:id", async (req, res) => {
    const blog = await Blog.findByIdAndUpdate(
        req.params.id,
        { $inc: { views: 1 } },
        { new: true }
    ).populate("createdBy");
    const comments = await Comment.find({ blogId: req.params.id }).populate("createdBy");
    return res.render("blog", {
        user: req.user,
        blog,
        comments,
        contentHTML: marked.parse(blog.body)
    });
});

router.post("/comments/:blogId", async(req, res) => {
    await Comment.create({
        content: req.body.content,
        blogId: req.params.blogId,
        createdBy: req.user._id
    });
    return res.redirect(`/blog/${req.params.blogId}`);
})


router.get("/edit/:id", async (req, res) => {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).send("Blog not found");
    if (blog.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).send("You are not authorized to edit this blog");
    }
    return res.render("editBlog", { blog, user: req.user });
});

router.post("/edit/:id", upload.single("coverImage"), async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).send("Blog not found");
        if (blog.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).send("You are not authorized to edit this blog");
        }

        blog.title = req.body.title;
        blog.body = req.body.content;
        if (req.file) {
            blog.coverImageURL = `/uploads/${req.user._id}/${req.file.filename}`;
        }
        await blog.save();
        return res.redirect(`/blog/${blog._id}`);
    } catch (error) {
        console.error("Edit blog error:", error);
        const blog = await Blog.findById(req.params.id);
        return res.render("editBlog", { blog, user: req.user, error: "Failed to update blog. Please try again." });
    }
});

router.post("/delete/:id", async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).send("Blog not found");
        if (blog.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).send("You are not authorized to delete this blog");
        }
        await Blog.findByIdAndDelete(req.params.id);
        await Comment.deleteMany({ blogId: req.params.id });
        return res.redirect("/");
    } catch (error) {
        console.error("Delete blog error:", error);
        return res.redirect("/");
    }
});
// ─── Edit Comment ─────────────────────────────────────────────────────────────
router.post("/comments/edit/:commentId", async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).send("Comment not found");
        if (comment.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).send("Not authorized");
        }
        comment.content = req.body.content;
        await comment.save();
        return res.redirect(`/blog/${req.body.blogId}`);
    } catch (error) {
        console.error("Edit comment error:", error);
        return res.redirect("back");
    }
});

// ─── Delete Comment ───────────────────────────────────────────────────────────
router.post("/comments/delete/:commentId", async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).send("Comment not found");

        const blog = await Blog.findById(req.body.blogId);
        if (!blog) return res.status(404).send("Blog not found");

        const isCommentOwner = comment.createdBy.toString() === req.user._id.toString();
        const isBlogOwner = blog.createdBy.toString() === req.user._id.toString();

        if (!isCommentOwner && !isBlogOwner) {
            return res.status(403).send("Not authorized");
        }
        await Comment.findByIdAndDelete(req.params.commentId);
        return res.redirect(`/blog/${req.body.blogId}`);
    } catch (error) {
        console.error("Delete comment error:", error);
        return res.redirect("back");
    }
});

module.exports = router;