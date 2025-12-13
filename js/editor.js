document.addEventListener('DOMContentLoaded', () => {
    const backToTopButton = document.getElementById('back-to-top');
    const toBottomButton = document.getElementById('to-bottom');

    if (backToTopButton && toBottomButton) {
        // Full document height for smooth bottom scrolling
        function getDocHeight() {
            return Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.offsetHeight,
                document.body.clientHeight,
                document.documentElement.clientHeight
            );
        }

        window.addEventListener('scroll', () => {
            backToTopButton.classList.toggle('visible', window.scrollY > 300);

            const scrolledToBottom =
                window.scrollY + window.innerHeight > getDocHeight() - 200;
            toBottomButton.classList.toggle('visible', !scrolledToBottom);
        });

        window.dispatchEvent(new Event('scroll'));

        backToTopButton.addEventListener('click', e => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        toBottomButton.addEventListener('click', e => {
            e.preventDefault();
            window.scrollTo({ top: getDocHeight(), behavior: 'smooth' });
        });
    }

    const titleInput = document.getElementById('post-title');
    const editor = document.getElementById('editor');

    const boldBtn = document.getElementById('bold-btn');
    const italicBtn = document.getElementById('italic-btn');
    const underlineBtn = document.getElementById('underline-btn');
    const hrBtn = document.getElementById('hr-btn');
    const decreaseFontBtn = document.getElementById('decrease-font-btn');
    const increaseFontBtn = document.getElementById('increase-font-btn');
    const alignLeftBtn = document.getElementById('align-left-btn');
    const alignCenterBtn = document.getElementById('align-center-btn');
    const alignRightBtn = document.getElementById('align-right-btn');

    const uploadImageBtn = document.getElementById('upload-image-btn');
    const uploadVideoBtn = document.getElementById('upload-video-btn');
    const fileInput = document.getElementById('file-input');

    const saveDraftBtn = document.getElementById('save-draft-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const publishBtn = document.getElementById('publish-btn');

    let isEditing = false;
    let currentPostId = null;
    let isDraft = false;

    // Temporary image tracking until publish
    let tempImages = [];

    const saveConfirmation = document.createElement('div');
    saveConfirmation.className = 'save-confirmation';
    saveConfirmation.innerHTML =
        `<i class="fa-solid fa-check-circle"></i> Draft saved successfully!`;
    document.body.appendChild(saveConfirmation);

    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');
    const draftId = urlParams.get('draftId');

    if (postId) {
        loadPostForEditing(postId, false);
        currentPostId = postId;
    } else if (draftId) {
        loadPostForEditing(draftId, true);
        currentPostId = draftId;
        isDraft = true;
    } else {
        currentPostId = 'new_' + Date.now();
    }

    if (editor.innerHTML.trim() === '') {
        editor.innerHTML = '<p><br></p>';
    }

    boldBtn.addEventListener('click', () => {
        document.execCommand('bold');
        toggleActiveState(boldBtn);
        editor.focus();
    });

    italicBtn.addEventListener('click', () => {
        document.execCommand('italic');
        toggleActiveState(italicBtn);
        editor.focus();
    });

    underlineBtn.addEventListener('click', () => {
        document.execCommand('underline');
        toggleActiveState(underlineBtn);
        editor.focus();
    });

    hrBtn.addEventListener('click', () => {
        document.execCommand('insertHorizontalRule');
        editor.focus();
    });

    decreaseFontBtn.addEventListener('click', () => {
        adjustFontSize(-1);
        editor.focus();
    });

    increaseFontBtn.addEventListener('click', () => {
        adjustFontSize(1);
        editor.focus();
    });

    alignLeftBtn.addEventListener('click', () => {
        formatAlignment('left');
        setActiveAlignButton(alignLeftBtn);
        editor.focus();
    });

    alignCenterBtn.addEventListener('click', () => {
        formatAlignment('center');
        setActiveAlignButton(alignCenterBtn);
        editor.focus();
    });

    alignRightBtn.addEventListener('click', () => {
        formatAlignment('right');
        setActiveAlignButton(alignRightBtn);
        editor.focus();
    });

    editor.addEventListener('mouseup', updateToolbarState);
    editor.addEventListener('keyup', updateToolbarState);

    uploadImageBtn.addEventListener('click', () => {
        fileInput.accept = 'image/*';
        fileInput.click();
    });

    uploadVideoBtn.addEventListener('click', () => {
        fileInput.accept = 'video/*';
        fileInput.click();
    });

    fileInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type.includes('image')) {
            const tempUrl = await readFileAsDataURL(file);
            insertTempImage(tempUrl, file);
        } else if (file.type.includes('video')) {
            try {
                const placeholder = document.createElement('div');
                placeholder.className = 'loading-placeholder';
                placeholder.textContent = 'Uploading video...';
                insertAtCursor(placeholder);

                const url = await uploadMedia(file, getPostFolderId());
                placeholder.remove();
                insertVideo(url);
            } catch (error) {
                console.error('Upload failed:', error);
                alert('Failed to upload video.');
            }
        }

        fileInput.value = '';
    });

    // Paste images directly as data URLs for fast feedback
    editor.addEventListener('paste', e => {
        const items = e.clipboardData?.items || [];
        for (const item of items) {
            if (item.type.startsWith('image')) {
                e.preventDefault();
                readFileAsDataURL(item.getAsFile())
                    .then(dataUrl => insertTempImage(dataUrl, item.getAsFile()))
                    .catch(err => console.error(err));
                return;
            }
        }
    });

    // Ensure consistent paragraph structure on Enter
    editor.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            let node = selection.getRangeAt(0).startContainer;
            while (node && node !== editor) {
                if (node.nodeName === 'P') return;
                node = node.parentNode;
            }

            e.preventDefault();
            document.execCommand('insertParagraph');
        }
    });

    cancelBtn.addEventListener('click', () => {
        if (confirm('Discard changes?')) {
            window.location.href = 'index.html';
        }
    });

    publishBtn.addEventListener('click', async () => {
        publishBtn.disabled = true;
        publishBtn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...';

        try {
            await processTemporaryImages();
            publishPost();
        } catch (error) {
            console.error(error);
            alert('Publishing failed.');
            publishBtn.disabled = false;
        }
    });

    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function insertTempImage(dataUrl, originalFile) {
        const img = document.createElement('img');
        img.src = dataUrl;
        img.classList.add('temp-image');

        const tempId = `temp-img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        img.dataset.tempId = tempId;

        tempImages.push({ id: tempId, file: originalFile, element: img });
        insertAtCursor(img);
        insertAtCursor(document.createElement('br'));
    }

    async function processTemporaryImages() {
        if (!tempImages.length) return;

        const folderId = getPostFolderId();
        for (const img of tempImages) {
            try {
                const url = await uploadMedia(img.file, folderId);
                img.element.src = url;
                img.element.classList.remove('temp-image');
                img.element.removeAttribute('data-temp-id');
            } catch (e) {
                console.error('Image upload failed:', e);
            }
        }
        tempImages = [];
    }

    function getPostFolderId() {
        if (currentPostId.startsWith('post_')) {
            return currentPostId.split('_')[1];
        }
        if (currentPostId.startsWith('new_')) {
            return 'temp_' + currentPostId.split('_')[1];
        }
        return currentPostId;
    }

    function formatAlignment(align) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        let node = selection.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

        while (node !== editor && !isBlockElement(node)) {
            node = node.parentNode;
        }

        if (node !== editor) {
            node.removeAttribute('data-align');
            if (align !== 'left') node.dataset.align = align;
            node.style.textAlign = align;
        }
    }

    function isBlockElement(node) {
        return ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE']
            .includes(node.nodeName);
    }

    function toggleActiveState(button) {
        button.classList.toggle('active');
    }

    function setActiveAlignButton(active) {
        [alignLeftBtn, alignCenterBtn, alignRightBtn]
            .forEach(btn => btn.classList.remove('active'));
        active.classList.add('active');
    }

    function updateToolbarState() {
        setTimeout(() => {
            boldBtn.classList.toggle('active', document.queryCommandState('bold'));
            italicBtn.classList.toggle('active', document.queryCommandState('italic'));
            underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
        });
    }

    function adjustFontSize(delta) {
        const size = parseInt(document.queryCommandValue('fontSize')) || 3;
        document.execCommand('fontSize', false, Math.max(1, Math.min(7, size + delta)));
    }

    function insertAtCursor(element) {
        editor.focus();
        const selection = window.getSelection();

        if (selection.rangeCount) {
            const range = selection.getRangeAt(0);
            range.insertNode(element);
            range.setStartAfter(element);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            editor.appendChild(element);
        }
    }

    function insertVideo(url) {
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        insertAtCursor(video);
        insertAtCursor(document.createElement('br'));
    }

    saveDraftBtn.addEventListener('click', async () => {
        saveDraftBtn.disabled = true;
        saveDraftBtn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            await saveDraft();
            saveConfirmation.classList.add('show');
            setTimeout(() => saveConfirmation.classList.remove('show'), 3000);
        } finally {
            saveDraftBtn.disabled = false;
            saveDraftBtn.innerHTML =
                '<i class="fa-solid fa-floppy-disk"></i> Save Draft';
        }
    });

    async function saveDraft() {
        const draftData = {
            title: titleInput.value.trim(),
            content: editor.innerHTML,
            lastSaved: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (isDraft) {
            await draftsCollection.doc(currentPostId).update(draftData);
        } else {
            const docRef = await draftsCollection.add(draftData);
            currentPostId = docRef.id;
            isDraft = true;
            window.history.pushState({}, '', `create.html?draftId=${currentPostId}`);
        }
    }

    async function loadPostForEditing(id, draft) {
        try {
            const collection = draft ? draftsCollection : postsCollection;
            const doc = await collection.doc(id).get();

            if (!doc.exists) throw new Error('Not found');

            const post = doc.data();
            isEditing = true;
            isDraft = draft;
            currentPostId = id;

            titleInput.value = post.title || '';
            editor.innerHTML = post.content || '';
            updateToolbarState();
        } catch {
            alert('Failed to load post.');
            window.location.href = 'index.html';
        }
    }

    async function publishPost() {
        const content = editor.innerHTML;
        if (!content.trim() || content === '<p><br></p>') {
            alert('Post content is empty.');
            publishBtn.disabled = false;
            return;
        }

        try {
            if (isEditing && !isDraft) {
                await postsCollection.doc(currentPostId).update({
                    title: titleInput.value.trim(),
                    content,
                    lastEdited: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                const ref = await postsCollection.add({
                    title: titleInput.value.trim(),
                    content,
                    date: firebase.firestore.FieldValue.serverTimestamp()
                });

                if (isDraft) {
                    await draftsCollection.doc(currentPostId).delete();
                }
            }

            window.location.href = 'index.html';
        } catch (e) {
            console.error(e);
            alert('Publish failed.');
            publishBtn.disabled = false;
        }
    }
});