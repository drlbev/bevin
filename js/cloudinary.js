// Cloudinary configuration and upload function
const CLOUDINARY_CLOUD_NAME = 'dlgtw9wzf'; // Replace with your Cloudinary cloud name
const CLOUDINARY_UPLOAD_PRESET = 'blog_uploads'; // Replace with your upload preset

// Modified to accept postId parameter
async function uploadToCloudinary(file, postId) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        
        // Create folder path using post ID
        const folderPath = postId ? `blog/post/${postId}` : 'blog/temp';
        formData.append('folder', folderPath);
        
        fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            resolve(data.secure_url);
        })
        .catch(error => {
            console.error('Error uploading to Cloudinary:', error);
            reject(error);
        });
    });
}