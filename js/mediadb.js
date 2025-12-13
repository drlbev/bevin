// ImageKit configuration
const IMAGEKIT_PUBLIC_KEY = 'public_JIvpsW3jQKsOPeR69h18/4VTL6Q=';
const IMAGEKIT_PRIVATE_KEY = 'private_zAoHULjlGza2hJPer5TnBSRUOzA=';
const IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/xyd2wxord';

// Generate ImageKit authentication signature
function generateImageKitSignature(fileName, timestamp) {
    const token = `${IMAGEKIT_PRIVATE_KEY}${timestamp}${fileName}`;
    return CryptoJS.SHA1(token).toString(); // requires crypto-js
}

// Upload function (ImageKit only)
async function uploadMedia(file, postId) {
    const folderPath = postId ? `blog/post/${postId}` : 'blog/temp';

    const timestamp = Date.now().toString();
    const fileName = file.name || `upload_${timestamp}`;
    const signature = generateImageKitSignature(fileName, timestamp);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('publicKey', IMAGEKIT_PUBLIC_KEY);
    formData.append('signature', signature);
    formData.append('expire', (parseInt(timestamp) + 3600000).toString()); // 1 hour
    formData.append('token', timestamp);
    formData.append('fileName', fileName);
    formData.append('folder', folderPath);

    const response = await fetch(
        'https://upload.imagekit.io/api/v1/files/upload',
        {
            method: 'POST',
            body: formData
        }
    );

    if (!response.ok) {
        throw new Error(`ImageKit upload failed: ${response.status}`);
    }

    const data = await response.json();
    return data.url; // public ImageKit URL
}
