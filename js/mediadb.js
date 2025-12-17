async function uploadMedia(file, postId) {
    const folder = postId
        ? `blog/post/${postId}`
        : 'blog/temp';

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async () => {
            try {
                const response = await fetch('http://localhost:3000/upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        file: reader.result,   // base64
                        fileName: file.name,
                        folder
                    })
                });

                if (!response.ok) {
                    throw new Error('Upload failed');
                }

                const data = await response.json();
                resolve(data.url); // ImageKit public URL
            } catch (err) {
                console.error('Media upload error:', err);
                reject(err);
            }
        };

        reader.onerror = err => reject(err);
        reader.readAsDataURL(file);
    });
}
