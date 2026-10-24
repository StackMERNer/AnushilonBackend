// upload middleware
import multer from "multer";

// Set up storage for multer
const storage = multer.memoryStorage(); // Store file in memory to send it to Cloudinary

const upload = multer({ storage });

export default upload;
