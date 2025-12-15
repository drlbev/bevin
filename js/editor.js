document.addEventListener('DOMContentLoaded', () => {
    // Page title + unsaved indicator
    function updatePageTitle(title, dirty = false) {
        const base = title?.trim() || 'Create New Post';
        document.title = dirty ? `* ${base}` : base;
    }

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
    const decreaseFontBtn = document.getElementById('decrease-font-btn');
    const increaseFontBtn = document.getElementById('increase-font-btn');
    const alignLeftBtn = document.getElementById('align-left-btn');
    const alignCenterBtn = document.getElementById('align-center-btn');
    const alignRightBtn = document.getElementById('align-right-btn');
    const uploadImageBtn = document.getElementById('upload-image-btn');
    const uploadVideoBtn = document.getElementById('upload-video-btn');
    const fileInput = document.getElementById('file-input');

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
    let tempImages = [];

    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');
    const draftId = params.get('draftId');

    if (postId) loadPostForEditing(postId, false);
    else if (draftId) {
        isDraft = true;
        loadPostForEditing(draftId, true);
    } else {
        currentPostId = 'new_' + Date.now();
        updatePageTitle('Create New Post');
    }

    if (!editor.innerHTML.trim()) editor.innerHTML = '<p><br></p>';

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

    function setSaveStatus(text, state = '') {
        saveStatus.textContent = text;
        saveStatus.className = `save-status ${state}`;
    }

    // Auto-save
    function debounceAutoSave() {
        if (isPublishing) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (hasChanges()) saveDraft(true);
        }, 1500);
    }

    autoSaveInterval = setInterval(() => {
        if (!hasChanges() || isPublishing) return;
        saveDraft(true);
    }, 5000);

    // Save draft
    async function saveDraft(auto = false) {
        if (isSaving) return;
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
            const draftData = {
                title,
                content,
                lastSaved: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (isDraft) {
                await draftsCollection.doc(currentPostId).update(draftData);
            } else {
                const ref = await draftsCollection.add(draftData);
                currentPostId = ref.id;
                isDraft = true;
                window.history.replaceState({}, '', `create.html?draftId=${currentPostId}`);
            }

            lastSavedTitle = title;
            lastSavedContent = content;

            if (!auto) {
                setSaveStatus('Saved', 'saved');
            } else {
                // Auto-save animation without interfering with manual save
                setSaveStatus('Saved', 'saved');
                setTimeout(() => setSaveStatus('Saved', ''), 800);
            }

            updatePageTitle(title, false);
        } catch (e) {
            console.error('Save failed:', e);
            setSaveStatus('Save failed');
        } finally {
            isSaving = false;
        }
    }

    saveDraftBtn.addEventListener('click', () => saveDraft(false));

    async function loadPostForEditing(id, draft) {
        const collection = draft ? draftsCollection : postsCollection;
        const doc = await collection.doc(id).get();

        if (!doc.exists) {
            alert('Post not found');
            return (window.location.href = 'index.html');
        }

        const post = doc.data();
        currentPostId = id;
        isEditing = true;

        titleInput.value = post.title || '';
        editor.innerHTML = post.content || '<p><br></p>';

        lastSavedTitle = post.title || '';
        lastSavedContent = post.content || '';

        updatePageTitle(post.title || 'Untitled');
        setSaveStatus('Saved', 'saved');
    }

    // Publish
    publishBtn.addEventListener('click', async () => {
        if (isPublishing) return;
        isPublishing = true;
        setSaveStatus('Publishing…', 'saving');

        clearInterval(autoSaveInterval);

        const content = editor.innerHTML.trim();
        if (!content || content === '<p><br></p>') {
            alert('Post is empty');
            isPublishing = false;
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
        } catch (e) {
            console.error(e);
            alert('Publish failed');
            isPublishing = false;
        }
    });

    window.addEventListener('online', () => {
        if (pendingOfflineSave) {
            pendingOfflineSave = false;
            saveDraft(true);
        }
    });

    cancelBtn.addEventListener('click', () => {
        if (hasChanges() && !confirm('Discard unsaved changes?')) return;
        window.location.href = 'index.html';
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
            const url = await uploadMedia(file, currentPostId);
            insertVideo(url);
        }
        fileInput.value = '';
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const ctrl = isMac ? e.metaKey : e.ctrlKey;
        if (!ctrl) return;

        switch (e.key.toLowerCase()) {
            case 's': e.preventDefault(); saveDraft(false); break; // ctrl + s to save
            case 'enter': e.preventDefault(); publishBtn.click(); break; // ctrl + enter to publish
            case 'b': e.preventDefault(); document.execCommand('bold'); break; // ctrl + b to bold text
            case 'i': e.preventDefault(); document.execCommand('italic'); break; // ctrl + i to italize text
            case 'u': e.preventDefault(); document.execCommand('underline'); break; // ctrl + u to underline text
        }
    });

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
        img.classList.add('temp-image');
        insertAtCursor(img);
        insertAtCursor(document.createElement('br'));
    }

    function insertVideo(url) {
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        insertAtCursor(video);
        insertAtCursor(document.createElement('br'));
    }

    function insertAtCursor(el) {
        const sel = window.getSelection();
        if (sel.rangeCount) {
            const range = sel.getRangeAt(0);
            range.insertNode(el);
            range.setStartAfter(el);
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            editor.appendChild(el);
        }
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
});