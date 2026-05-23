const { Router } = require("express");
const User = require("../models/user");
const { createTokenForUser } = require("../service/auththentication");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = Router();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.resolve(`./public/images/profiles`);
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const fileName = `${Date.now()}-${file.originalname}`;
        cb(null, fileName);
    }
});

const upload = multer({ storage: storage });
router.get("/signin", (req, res) => {
    return res.render("signin");
});

router.get("/signup", (req, res) => {
    return res.render("signup");
});

router.post("/signup", upload.single("profileImage"), async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        const userData = { fullName, email, password };
        if (req.file) {
            userData.profileImageURL = `/images/profiles/${req.file.filename}`;
        }
        await User.create(userData);
        
        const token = await User.matchPasswordAndGenerateToken(email, password);
        return res.cookie("token", token).redirect("/");
    }
    catch (error) {
        console.error("Signup error:", error);
        let errorMessage = "Something went wrong. Please try again.";
        if (error.code === 11000) {
            errorMessage = "An account with this email already exists. Please sign in or use a different email.";
        }
        return res.render("signup", { error: errorMessage });
    }
});

router.post("/signin", async (req, res) => {
    const {email, password} = req.body;
    try{
        const token = await User.matchPasswordAndGenerateToken(email, password);
        return res.cookie("token", token).redirect("/");
    }
    catch (error){
        return res.render("signin", {
            error: "Incorrect Email or Password"
        });

    }
});

router.post("/update-profile-image", upload.single("profileImage"), async (req, res) => {
    try {
        if (!req.file) {
            return res.redirect("/");
        }
        
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id, 
            { profileImageURL: `/images/profiles/${req.file.filename}` },
            { new: true }
        );
        
        const token = createTokenForUser(updatedUser);
        
        return res.cookie("token", token).redirect("/");
    } catch(error) {
        console.error("Profile image update error:", error);
        return res.redirect("/");
    }
});

router.get("/logout", async(req, res) => {
    res.clearCookie("token").redirect("/");
})
module.exports = router;