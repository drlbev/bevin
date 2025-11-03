const CLOUDINARY_CLOUD_NAME = 'dlgtw9wzf'; // Your Cloudinary cloud name
const CLOUDINARY_UPLOAD_PRESET = 'blog_uploads'; // Your Cloudinary upload preset

// ImageKit configuration (add your credentials here)
const IMAGEKIT_PUBLIC_KEY = 'public_JIvpsW3jQKsOPeR69h18/4VTL6Q='; // Replace with your ImageKit public key
const IMAGEKIT_PRIVATE_KEY = 'private_zAoHULjlGza2hJPer5TnBSRUOzA='; // Replace with your ImageKit private key (keep secure!)
const IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/xyd2wxord'; // Replace with your ImageKit URL endpoint

// Function to generate ImageKit authentication signature
function generateImageKitSignature(fileName, timestamp) {
    const token = `${IMAGEKIT_PRIVATE_KEY}${timestamp}${fileName}`;
    return CryptoJS.SHA1(token).toString(); // Requires crypto-js library
}

// Modified upload function with ImageKit fallback
async function uploadToCloudinary(file, postId) {
    const folderPath = postId ? `blog/post/${postId}` : 'blog/temp';
    
    // Try Cloudinary first
    try {
        const cloudinaryFormData = new FormData();
        cloudinaryFormData.append('file', file);
        cloudinaryFormData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        cloudinaryFormData.append('folder', folderPath);
        
        const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
            method: 'POST',
            body: cloudinaryFormData
        });
        
        if (!cloudinaryResponse.ok) {
            throw new Error(`Cloudinary upload failed: ${cloudinaryResponse.status}`);
        }
        
        const cloudinaryData = await cloudinaryResponse.json();
        return cloudinaryData.secure_url;
    } catch (error) {
        console.warn('Cloudinary upload failed, falling back to ImageKit:', error);
        
        // Fallback to ImageKit
        const timestamp = Date.now().toString();
        const fileName = file.name || `upload_${timestamp}`;
        const signature = generateImageKitSignature(fileName, timestamp);
        
        const imagekitFormData = new FormData();
        imagekitFormData.append('file', file);
        imagekitFormData.append('publicKey', IMAGEKIT_PUBLIC_KEY);
        imagekitFormData.append('signature', signature);
        imagekitFormData.append('expire', (parseInt(timestamp) + 3600000).toString()); // Expire in 1 hour
        imagekitFormData.append('token', timestamp);
        imagekitFormData.append('fileName', fileName);
        imagekitFormData.append('folder', folderPath); // Optional: organize in folders
        
        const imagekitResponse = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
            method: 'POST',
            body: imagekitFormData
        });
        
        if (!imagekitResponse.ok) {
            throw new Error(`ImageKit upload failed: ${imagekitResponse.status}`);
        }
        
        const imagekitData = await imagekitResponse.json();
        return imagekitData.url; // ImageKit returns 'url' for the public URL
    }
}