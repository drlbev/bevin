document.addEventListener('DOMContentLoaded', () => {
    // Page title
    function updatePageTitle(title) {
        const text = title && title.trim() ? title.trim() : 'Create New Post';
        document.title = text;
    }

    // Back to top / to bottom buttons
    const backToTopButton = document.getElementById('back-to-top');
    const toBottomButton = document.getElementById('to-bottom');

    if (backToTopButton && toBottomButton) {
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
    } else if (draftId) {
        loadPostForEditing(draftId, true);
        isDraft = true;
    } else {
        currentPostId = 'new_' + Date.now();
        updatePageTitle('Create New Post');
    }

    if (editor.innerHTML.trim() === '') {
        editor.innerHTML = '<p><br></p>';
    }

    titleInput.addEventListener('input', () => {
        if (isEditing || isDraft) {
            updatePageTitle(titleInput.value);
        }
    });

    boldBtn.onclick = () => document.execCommand('bold');
    italicBtn.onclick = () => document.execCommand('italic');
    underlineBtn.onclick = () => document.execCommand('underline');
    hrBtn.onclick = () => document.execCommand('insertHorizontalRule');

    decreaseFontBtn.onclick = () => adjustFontSize(-1);
    increaseFontBtn.onclick = () => adjustFontSize(1);

    alignLeftBtn.onclick = () => formatAlignment('left');
    alignCenterBtn.onclick = () => formatAlignment('center');
    alignRightBtn.onclick = () => formatAlignment('right');

    editor.addEventListener('mouseup', updateToolbarState);
    editor.addEventListener('keyup', updateToolbarState);

    // Media uploads
    uploadImageBtn.onclick = () => {
        fileInput.accept = 'image/*';
        fileInput.click();
    };

    uploadVideoBtn.onclick = () => {
        fileInput.accept = 'video/*';
        fileInput.click();
    };

    fileInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type.startsWith('image')) {
            const dataUrl = await readFileAsDataURL(file);
            insertTempImage(dataUrl, file);
        } else {
            const url = await uploadMedia(file, getPostFolderId());
            insertVideo(url);
        }

        fileInput.value = '';
    });

    // Save draft
    saveDraftBtn.onclick = async () => {
        saveDraftBtn.disabled = true;
        await saveDraft();
        saveConfirmation.classList.add('show');
        setTimeout(() => saveConfirmation.classList.remove('show'), 3000);
        saveDraftBtn.disabled = false;
    };

    async function saveDraft() {
        const data = {
            title: titleInput.value.trim(),
            content: editor.innerHTML,
            lastSaved: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (isDraft) {
            await draftsCollection.doc(currentPostId).update(data);
        } else {
            const ref = await draftsCollection.add(data);
            currentPostId = ref.id;
            isDraft = true;
            window.history.replaceState({}, '', `create.html?draftId=${currentPostId}`);
        }
    }

    async function loadPostForEditing(id, draft) {
        const collection = draft ? draftsCollection : postsCollection;
        const doc = await collection.doc(id).get();

        if (!doc.exists) {
            alert('Post not found.');
            window.location.href = 'index.html';
            return;
        }

        const post = doc.data();
        isEditing = true;
        currentPostId = id;

        titleInput.value = post.title || '';
        editor.innerHTML = post.content || '<p><br></p>';

        updatePageTitle(post.title || 'Untitled Post');
    }

    // Publish
    publishBtn.onclick = async () => {
        const content = editor.innerHTML.trim();
        if (!content || content === '<p><br></p>') {
            alert('Post is empty.');
            return;
        }

        if (isEditing && !isDraft) {
            await postsCollection.doc(currentPostId).update({
                title: titleInput.value.trim(),
                content,
                lastEdited: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await postsCollection.add({
                title: titleInput.value.trim(),
                content,
                date: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (isDraft) {
                await draftsCollection.doc(currentPostId).delete();
            }
        }

        window.location.href = 'index.html';
    };

    function readFileAsDataURL(file) {
        return new Promise(res => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result);
            reader.readAsDataURL(file);
        });
    }

    function insertTempImage(src, file) {
        const img = document.createElement('img');
        img.src = src;
        insertAtCursor(img);
    }

    function insertVideo(url) {
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        insertAtCursor(video);
    }

    function insertAtCursor(el) {
        const range = window.getSelection().getRangeAt(0);
        range.insertNode(el);
        range.setStartAfter(el);
    }

    function adjustFontSize(delta) {
        const size = parseInt(document.queryCommandValue('fontSize')) || 3;
        document.execCommand('fontSize', false, Math.max(1, Math.min(7, size + delta)));
    }

    function formatAlignment(align) {
        document.execCommand(`justify${align.charAt(0).toUpperCase() + align.slice(1)}`);
    }

    function updateToolbarState() {
        boldBtn.classList.toggle('active', document.queryCommandState('bold'));
        italicBtn.classList.toggle('active', document.queryCommandState('italic'));
        underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
    }

    function getPostFolderId() {
        return currentPostId;
    }
});
