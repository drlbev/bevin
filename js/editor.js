document.addEventListener('DOMContentLoaded', () => {
    const titleInput = document.getElementById('post-title');
    const editor = document.getElementById('editor');
    const saveStatus = document.getElementById('save-status');

    const toolbar = document.querySelector('.editor-toolbar');
    const toolbarToggle = document.getElementById('toolbar-toggle');

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

    const backToTopBtn = document.getElementById('back-to-top');
    const toBottomBtn = document.getElementById('to-bottom');

    const CLOUDINARY_CLOUD_NAME = 'dje1er5qv';
    const CLOUDINARY_UPLOAD_PRESET = 'blog_uploads';

    let currentPostId = null;
    let isDraft = false;
    let isEditing = false;
    let isSaving = false;
    let isPublishing = false;
    let pendingOfflineSave = false;

    let lastSavedTitle = '';
    let lastSavedContent = '';
    let debounceTimer = null;
    let autoSaveInterval = null;

    let activeLinkNode = null;
    let savedSelection = null;

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

    // Toggle toolbar
    toolbarToggle.addEventListener('click', (e) => {
        e.stopPropagation();

        toolbar.classList.toggle('open');
        toolbarToggle.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (
            toolbar.classList.contains('open') &&
            !toolbar.contains(e.target) &&
            !toolbarToggle.contains(e.target)
        ) {
            toolbar.classList.remove('open');
            toolbarToggle.classList.remove('active');
        }
    });

    toolbar.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            toolbar.classList.remove('open');
            toolbarToggle.classList.remove('active');
        });
    });

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

    // Link modal

    linkBtn.onclick = () => {
        const sel = window.getSelection();
        if (!sel.rangeCount || sel.isCollapsed) return alert('Select text first');

        saveSelection(); // <-- save selection
        activeLinkNode = null;
        linkModalTitle.textContent = 'Insert Link';
        linkUrlInput.value = '';
        openLinkModal();
    };

    editLinkBtn.onclick = () => {
        let node = window.getSelection().anchorNode;
        while (node && node.nodeName !== 'A') node = node.parentNode;
        if (!node) return alert('Cursor must be inside a link');

        activeLinkNode = node;
        linkModalTitle.textContent = 'Edit Link';
        linkUrlInput.value = node.href;
        openLinkModal();
    };

    unlinkBtn.onclick = () => document.execCommand('unlink');

    linkSaveBtn.onclick = () => {
        let url = linkUrlInput.value.trim();
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

        restoreSelection(); // <-- restore selection before creating link

        if (activeLinkNode) activeLinkNode.href = url;
        else document.execCommand('createLink', false, url);

        closeLinkModal();
    };

    linkCancelBtn.onclick = closeLinkModal;
    linkModal.onclick = e => e.target === linkModal && closeLinkModal();

    function openLinkModal() {
        linkModal.classList.remove('hidden');
        setTimeout(() => linkUrlInput.focus(), 50);
    }

    function closeLinkModal() {
        linkModal.classList.add('hidden');
        activeLinkNode = null;
    }

    function saveSelection() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) savedSelection = sel.getRangeAt(0);
}

    function restoreSelection() {
        if (savedSelection) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedSelection);
        }
    }

    // Link behavior

    editor.addEventListener('click', e => {
        const link = e.target.closest('a');
        if (!link) return;

        const isMac = navigator.platform.includes('Mac');
        if ((isMac && e.metaKey) || (!isMac && e.ctrlKey)) {
            window.open(link.href, '_blank');
        }
    });

    editor.addEventListener('paste', e => {
        const text = e.clipboardData.getData('text');
        if (/https?:\/\//i.test(text)) {
            e.preventDefault();
            document.execCommand('insertHTML', false,
                text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')
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
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);

        if (range.collapsed) return;

        const span = document.createElement('span');

        const parent = range.commonAncestorContainer.nodeType === 1
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentElement;

        const computedSize = window.getComputedStyle(parent).fontSize;
        const currentPx = parseFloat(computedSize) || 14;

        const newSize = Math.max(10, currentPx + delta);

        span.style.fontSize = `${newSize}px`;

        range.surroundContents(span);

        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.addRange(newRange);
    }

    function formatAlign(dir) {
        document.execCommand(`justify${dir}`);
    }

    // Page navigation buttons

    function updateScrollButtons() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = window.innerHeight;

        const canScroll = scrollHeight > clientHeight + 80;

        if (!canScroll) {
            backToTopBtn.classList.remove('visible');
            toBottomBtn.classList.remove('visible');
            return;
        }

        if (scrollTop > 120) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }

        if (scrollTop + clientHeight < scrollHeight - 120) {
            toBottomBtn.classList.add('visible');
        } else {
            toBottomBtn.classList.remove('visible');
        }
    }

    // Scroll behavior

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    toBottomBtn.addEventListener('click', () => {
        window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth'
        });
    });

    window.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);
    editor.addEventListener('input', updateScrollButtons);

    setTimeout(updateScrollButtons, 300);

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