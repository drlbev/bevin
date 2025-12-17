import express from 'express';
import cors from 'cors';
import ImageKit from 'imagekit';

const app = express();

// Increase size for video uploads
app.use(cors());
app.use(express.json({ limit: '100mb' }));

const imagekit = new ImageKit({
    publicKey: 'public_JIvpsW3jQKsOPeR69h18/4VTL6Q=',
    privateKey: 'private_zAoHULjlGza2hJPer5TnBSRUOzA=',
    urlEndpoint: 'https://ik.imagekit.io/xyd2wxord'
});

app.post('/upload', async (req, res) => {
    try {
        const { file, fileName, folder } = req.body;

        if (!file || !fileName) {
            return res.status(400).json({ error: 'Missing file data' });
        }

        const result = await imagekit.upload({
            file,          // base64 string
            fileName,
            folder
        });

        res.json({ url: result.url });
    } catch (err) {
        console.error('ImageKit upload failed:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

app.listen(3000, () => {
    console.log('✅ ImageKit server running at http://localhost:3000');
});
