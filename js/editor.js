document.addEventListener('DOMContentLoaded', () => {
    const titleInput = document.getElementById('post-title');
    const editor = document.getElementById('editor');
    const saveStatus = document.getElementById('save-status');

    const publishBtn = document.getElementById('publish-btn');
    const saveDraftBtn = document.getElementById('save-draft-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    const boldBtn = document.getElementById('bold-btn');
    const italicBtn = document.getElementById('italic-btn');
    const underlineBtn = document.getElementById('underline-btn');
    const hrBtn = document.getElementById('hr-btn');
    const linkBtn = document.getElementById('link-btn');
    const editLinkBtn = document.getElementById('edit-link-btn');
    const unlinkBtn = document.getElementById('unlink-btn');
    const linkModal = document.getElementById('link-modal');
    const linkUrlInput = document.getElementById('link-url-input');
    const linkSaveBtn = document.getElementById('link-save-btn');
    const linkCancelBtn = document.getElementById('link-cancel-btn');
    const linkModalTitle = document.getElementById('link-modal-title');
    const decreaseFontBtn = document.getElementById('decrease-font-btn');
    const increaseFontBtn = document.getElementById('increase-font-btn');
    const alignLeftBtn = document.getElementById('align-left-btn');
    const alignCenterBtn = document.getElementById('align-center-btn');
    const alignRightBtn = document.getElementById('align-right-btn');
    const uploadImageBtn = document.getElementById('upload-image-btn');
    const uploadVideoBtn = document.getElementById('upload-video-btn');
    const fileInput = document.getElementById('file-input');

    const CLOUDINARY_CLOUD_NAME = 'dje1er5qv';
    const CLOUDINARY_UPLOAD_PRESET = 'blog_uploads';

    let currentPostId = null;
    let isDraft = false;
    let isEditing = false;
    let isSaving = false;
    let isPublishing = false;

    let lastSavedTitle = '';
    let lastSavedContent = '';
    let debounceTimer = null;
    let autoSaveInterval = null;
    let pendingOfflineSave = false;
    let activeLinkNode = null;

    // Page title

    function updatePageTitle(title, dirty = false) {
        const base = title?.trim() || 'Create New Post';
        document.title = dirty ? `* ${base}` : base;
    }

    function setSaveStatus(text, state = '') {
        saveStatus.textContent = text;
        saveStatus.className = `save-status ${state}`;
    }

    function hasChanges() {
        return (
            titleInput.value.trim() !== lastSavedTitle ||
            editor.innerHTML !== lastSavedContent
        );
    }

    function markDirty() {
        updatePageTitle(titleInput.value, true);
        setSaveStatus('Unsaved');
    }

    // Load draft/post

    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');
    const draftId = params.get('draftId');

    if (postId) loadPost(postId, false);
    else if (draftId) loadPost(draftId, true);
    else {
        currentPostId = `new_${Date.now()}`;
        updatePageTitle('Create New Post');
        editor.innerHTML = '<p><br></p>';
    }

    async function loadPost(id, draft) {
        const col = draft ? draftsCollection : postsCollection;
        const doc = await col.doc(id).get();

        if (!doc.exists) {
            alert('Post not found');
            return (window.location.href = 'index.html');
        }

        const data = doc.data();
        currentPostId = id;
        isDraft = draft;
        isEditing = true;

        titleInput.value = data.title || '';
        editor.innerHTML = data.content || '<p><br></p>';

        lastSavedTitle = data.title || '';
        lastSavedContent = data.content || '';

        updatePageTitle(data.title);
        setSaveStatus('Saved', 'saved');
    }

    // Auto-save

    function debounceAutoSave() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (hasChanges()) saveDraft(true);
        }, 1500);
    }

    autoSaveInterval = setInterval(() => {
        if (hasChanges() && !isPublishing) saveDraft(true);
    }, 5000);

    async function saveDraft(auto = false) {
        if (isSaving || isPublishing) return;

        if (!navigator.onLine) {
            pendingOfflineSave = true;
            setSaveStatus('Offline', 'offline');
            return;
        }

        const title = titleInput.value.trim();
        const content = editor.innerHTML.trim();
        if (!content || content === '<p><br></p>') return;

        isSaving = true;
        setSaveStatus('Saving…', 'saving');

        try {
            const data = {
                title,
                content,
                lastSaved: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (isDraft) {
                await draftsCollection.doc(currentPostId).update(data);
            } else {
                const ref = await draftsCollection.add(data);
                currentPostId = ref.id;
                isDraft = true;
                history.replaceState({}, '', `create.html?draftId=${currentPostId}`);
            }

            lastSavedTitle = title;
            lastSavedContent = content;

            setSaveStatus('Saved', 'saved');
            updatePageTitle(title, false);
        } catch (err) {
            console.error(err);
            setSaveStatus('Save failed');
        } finally {
            isSaving = false;
        }
    }

    saveDraftBtn.addEventListener('click', () => saveDraft(false));

    // Publish

    publishBtn.addEventListener('click', async () => {
        if (isPublishing) return;

        const content = editor.innerHTML.trim();
        if (!content || content === '<p><br></p>') {
            alert('Post is empty');
            return;
        }

        isPublishing = true;
        setSaveStatus('Publishing…', 'saving');
        clearInterval(autoSaveInterval);

        try {
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

                if (isDraft) await draftsCollection.doc(currentPostId).delete();
            }

            window.location.href = 'index.html';
        } catch (err) {
            console.error(err);
            alert('Publish failed');
            isPublishing = false;
        }
    });

    cancelBtn.addEventListener('click', () => {
        if (hasChanges() && !confirm('Discard unsaved changes?')) return;
        window.location.href = 'index.html';
    });

    // Toolbar formatting

    boldBtn.onclick = () => document.execCommand('bold');
    italicBtn.onclick = () => document.execCommand('italic');
    underlineBtn.onclick = () => document.execCommand('underline');
    hrBtn.onclick = () => document.execCommand('insertHorizontalRule');

    decreaseFontBtn.onclick = () => adjustFontSize(-1);
    increaseFontBtn.onclick = () => adjustFontSize(1);

    alignLeftBtn.onclick = () => formatAlign('Left');
    alignCenterBtn.onclick = () => formatAlign('Center');
    alignRightBtn.onclick = () => formatAlign('Right');

    editor.addEventListener('input', () => {
        markDirty();
        debounceAutoSave();
    });

    linkBtn.onclick = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount || selection.isCollapsed) {
            alert('Please select text first');
            return;
        }

        let url = prompt('Enter URL (https://...)');
        if (!url) return;

        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        document.execCommand('createLink', false, url);
    };

    editLinkBtn.onclick = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        let node = selection.anchorNode;
        while (node && node.nodeName !== 'A') {
            node = node.parentNode;
        }

        if (!node || node.nodeName !== 'A') {
            alert('Place cursor inside a link to edit it');
            return;
        }

        let newUrl = prompt('Edit URL:', node.href);
        if (!newUrl) return;

        if (!/^https?:\/\//i.test(newUrl)) {
            newUrl = 'https://' + newUrl;
        }

        node.href = newUrl;
    };

        unlinkBtn.onclick = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        let node = selection.anchorNode;
        while (node && node.nodeName !== 'A') {
            node = node.parentNode;
        }

        if (!node || node.nodeName !== 'A') {
            alert('Place cursor inside a link to remove it');
            return;
        }

        document.execCommand('unlink');
    };

    editor.addEventListener('click', e => {
        const link = e.target.closest('a');
        if (!link) return;

        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const ctrl = isMac ? e.metaKey : e.ctrlKey;

        if (ctrl) {
            window.open(link.href, '_blank');
        }
    });


    editor.addEventListener('paste', e => {
        const text = (e.clipboardData || window.clipboardData).getData('text');
        if (!text) return;

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        if (urlRegex.test(text)) {
            e.preventDefault();
            document.execCommand(
                'insertHTML',
                false,
                text.replace(urlRegex, '<a href="$1" target="_blank">$1</a>')
            );
        }
    });

    // Media Upload

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

        try {
            setSaveStatus('Uploading…', 'saving');

            const url = await uploadMedia(file, currentPostId);

            if (file.type.startsWith('image')) {
                insertImage(url);
            } else {
                insertVideo(url);
            }

            markDirty();
            debounceAutoSave();
        } catch (err) {
            console.error(err);
            alert('Upload failed');
        }

        fileInput.value = '';
    });

    async function uploadMedia(file, postId) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', `posts/${postId}`);

        const res = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
            {
                method: 'POST',
                body: formData
            }
        );

        if (!res.ok) {
            throw new Error('Cloudinary upload failed');
        }

        const data = await res.json();
        return data.secure_url;
    }

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function insertImage(url) {
        const img = document.createElement('img');
        img.src = url;
        insertAtCursor(img);
        insertAtCursor(document.createElement('p'));
    }

    function insertVideo(url) {
        const wrapper = document.createElement('div');
        wrapper.contentEditable = false;

        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.style.width = '100%';
        video.style.borderRadius = '8px';

        wrapper.appendChild(video);
        insertAtCursor(wrapper);
        insertAtCursor(document.createElement('p'));
    }

    function insertAtCursor(el) {
        const sel = window.getSelection();
        if (!sel.rangeCount) {
            editor.appendChild(el);
            return;
        }

        const range = sel.getRangeAt(0);
        range.insertNode(el);
        range.setStartAfter(el);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function adjustFontSize(delta) {
        const size = parseInt(document.queryCommandValue('fontSize')) || 3;
        document.execCommand('fontSize', false, Math.min(7, Math.max(1, size + delta)));
    }

    function formatAlign(dir) {
        document.execCommand(`justify${dir}`);
    }

    // Link modals
    linkBtn.onclick = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount || selection.isCollapsed) {
            alert('Please select text first');
            return;
        }

        activeLinkNode = null;
        linkModalTitle.textContent = 'Insert Link';
        linkUrlInput.value = '';
        openLinkModal();
    };

    editLinkBtn.onclick = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        let node = selection.anchorNode;
        while (node && node.nodeName !== 'A') {
            node = node.parentNode;
        }

        if (!node || node.nodeName !== 'A') {
            alert('Place cursor inside a link');
            return;
        }

        activeLinkNode = node;
        linkModalTitle.textContent = 'Edit Link';
        linkUrlInput.value = node.href;
        openLinkModal();
    };

    linkSaveBtn.onclick = () => {
        let url = linkUrlInput.value.trim();
        if (!url) return;

        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        if (activeLinkNode) {
            // Edit existing link
            activeLinkNode.href = url;
        } else {
            // Create new link
            document.execCommand('createLink', false, url);
        }

        closeLinkModal();
    };

    linkCancelBtn.onclick = closeLinkModal;

    linkModal.addEventListener('click', e => {
        if (e.target === linkModal) closeLinkModal();
    });

    function openLinkModal() {
        linkModal.classList.remove('hidden');
        setTimeout(() => linkUrlInput.focus(), 50);
    }

    function closeLinkModal() {
        linkModal.classList.add('hidden');
        linkUrlInput.value = '';
        activeLinkNode = null;
    }

    // Keyboard shortcuts

    document.addEventListener('keydown', e => {
        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const ctrl = isMac ? e.metaKey : e.ctrlKey;
        if (!ctrl) return;

        switch (e.key.toLowerCase()) {
            case 's': e.preventDefault(); saveDraft(false); break;
            case 'enter': e.preventDefault(); publishBtn.click(); break;
            case 'b': e.preventDefault(); document.execCommand('bold'); break;
            case 'i': e.preventDefault(); document.execCommand('italic'); break;
            case 'u': e.preventDefault(); document.execCommand('underline'); break;
        }
    });

    window.addEventListener('online', () => {
        if (pendingOfflineSave) {
            pendingOfflineSave = false;
            saveDraft(true);
        }
    });

});