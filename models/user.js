const {createHmac, randomBytes} = require("crypto");
const {Schema, model} = require("mongoose");
const {createTokenForUser, validateToken} = require("../service/auththentication")
const userSchema = new Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    salt: {
        type: String,
    },
    password: {
        type: String,
        required: true,
    },
    profileImageURL: {
        type: String,
        default: "/images/default.svg"
    },
    role: {
        type: String,
        enum: ['USER', 'ADMIN'],
        default: 'USER'
    }
}, {timestamps: true});

userSchema.pre("save", async function () {
    const user = this;
    if (!user.isModified("password")) return;
    const salt = randomBytes(16).toString("hex");
    const hashPassword = createHmac("sha256", salt)
    .update(user.password)
    .digest("hex");

    this.salt = salt;
    this.password = hashPassword;
});

userSchema.static("matchPasswordAndGenerateToken", async function(email, password){
    const user = await this.findOne({email});
    if (!user) throw new Error("User not found");

    const salt = user.salt;
    const hashedPassword = user.password;

    const userProvidedHash = createHmac("sha256", salt)
    .update(password)
    .digest("hex");

    if (userProvidedHash === hashedPassword){
        const token = createTokenForUser(user);
        return token;
    }
    else throw new Error("Incorrect Password");
})
const User = model("user", userSchema);

module.exports = User;