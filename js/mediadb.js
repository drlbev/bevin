// Cloudinary
const CLOUDINARY_CLOUD_NAME = 'dje1er5qv';
const CLOUDINARY_UPLOAD_PRESET = 'blog_uploads';

// Upload function 
async function uploadToCloudinary(file, postId) {
    const folderPath = postId ? `blog/post/${postId}` : 'blog/temp';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', folderPath);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
        {
            method: 'POST',
            body: formData
        }
    );

    if (!response.ok) {
        throw new Error(`Cloudinary upload failed: ${response.status}`);
    }

    const data = await response.json();
    return data.secure_url; // Public URL of uploaded file
}