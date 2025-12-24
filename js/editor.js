document.addEventListener('DOMContentLoaded', () => {
    const titleInput = document.getElementById('post-title');
    const descriptionInput = document.getElementById('post-description');
    const editor = document.getElementById('editor');
    const editorStatsEl = document.getElementById('editor-stats');
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
    const smallHrBtn = document.getElementById('small-hr-btn');

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
    const fontSizeSelect = document.getElementById('font-size-select');
    const fontSizeInput = document.getElementById('font-size-input');

    const alignLeftBtn = document.getElementById('align-left-btn');
    const alignCenterBtn = document.getElementById('align-center-btn');
    const alignRightBtn = document.getElementById('align-right-btn');

    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');

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
    let lastSavedDescription = '';
    let lastSavedContent = '';
    let debounceTimer = null;
    let autoSaveInterval = null;

    let activeLinkNode = null;
    let savedSelection = null;
    let lastTapTime = 0;
    let longPressTimer = null;

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
            descriptionInput.value.trim() !== lastSavedDescription ||
            editor.innerHTML !== lastSavedContent
        );
    }

    function markDirty() {
        updatePageTitle(titleInput.value, true);
        setSaveStatus('Unsaved');
    }

    descriptionInput.addEventListener('input', () => {
        markDirty();
        debounceAutoSave();
    });

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
        updateEditorStats();
        setTimeout(restoreScrollPosition, 100);
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
        descriptionInput.value = data.description || '';
        editor.innerHTML = data.content || '<p><br></p>';

        lastSavedTitle = data.title || '';
        lastSavedDescription = data.description || '';
        lastSavedContent = data.content || '';

        updatePageTitle(data.title);

        if (data.lastSaved) {
            setSaveStatus(`Last saved: ${formatDateTime(data.lastSaved)}`, 'saved');
        } else {
            setSaveStatus('Saved', 'saved');
        }

        updateEditorStats();
        setTimeout(restoreScrollPosition, 100);
    }

    // Editor counts
    function updateEditorStats() {
        if (!editor) return;

        // Word count
        const text = editor.innerText || '';
        const words = text.trim().split(/\s+/).filter(Boolean).length;

        // Media count
        const images = editor.querySelectorAll('img').length;
        const videos = editor.querySelectorAll('video').length;

        editorStatsEl.textContent = `Words: ${words} | Images: ${images} | Videos: ${videos}`;
    }

    editor.addEventListener('input', () => {
        markDirty();
        debounceAutoSave();
        updateEditorStats();
    });

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
        const description = descriptionInput.value.trim();
        const content = editor.innerHTML.trim();
        if (!content || content === '<p><br></p>') return;

        isSaving = true;
        setSaveStatus('Saving…', 'saving');

        try {
            const data = {
                title,
                description,
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
            lastSavedDescription = description;
            lastSavedContent = content;

            setSaveStatus(`Saved`, 'saved');
            updatePageTitle(title, false);
        } catch (err) {
            console.error(err);
            setSaveStatus('Save failed');
        } finally {
            isSaving = false;
        }
    }

    saveDraftBtn.addEventListener('click', () => saveDraft(false));

    function getScrollKey() {
        return `editor-scroll-${currentPostId || 'new'}`;
    }

    function saveScrollPosition() {
        localStorage.setItem(getScrollKey(), window.scrollY.toString());
    }

    window.addEventListener('scroll', saveScrollPosition);
    window.addEventListener('beforeunload', saveScrollPosition);

    function restoreScrollPosition() {
        const saved = localStorage.getItem(getScrollKey());
        if (!saved) return;

        requestAnimationFrame(() => {
            window.scrollTo({
                top: parseInt(saved, 10),
                behavior: 'instant'
            });
        });
    }

    function clearScrollPosition() {
        localStorage.removeItem(getScrollKey());
    }

    publishBtn.addEventListener('click', clearScrollPosition);
    cancelBtn.addEventListener('click', clearScrollPosition);

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
                    description: descriptionInput.value.trim(),
                    content,
                    lastEdited: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await postsCollection.add({
                    title: titleInput.value.trim(),
                    description: descriptionInput.value.trim(),
                    content,
                    date: firebase.firestore.FieldValue.serverTimestamp()
                });

                if (isDraft) await draftsCollection.doc(currentPostId).delete();
            }

            clearScrollPosition();
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

    function formatDateTime(timestamp) {
        const date =
            timestamp?.toDate?.() ||
            (timestamp ? new Date(timestamp) : new Date());

        return date.toLocaleString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }).replace(',', '');
    }

    // Toolbar formatting

    boldBtn.onclick = () => document.execCommand('bold');
    italicBtn.onclick = () => document.execCommand('italic');
    underlineBtn.onclick = () => document.execCommand('underline');
    
    hrBtn.onclick = () => {
        document.execCommand('insertHorizontalRule');

        const hrs = editor.querySelectorAll('hr');
        const hr = hrs[hrs.length - 1];
        if (!hr) return;

        hr.style.border = 'none';
        hr.style.borderTop = '1px solid #000';
        hr.style.width = '100%';
        hr.style.margin = '16px 0';

        markDirty();
        debounceAutoSave();
    };    

    smallHrBtn.onclick = insertSmallHr;

    decreaseFontBtn.onclick = () => adjustFontSize(-1);
    increaseFontBtn.onclick = () => adjustFontSize(1);

    fontSizeSelect.addEventListener('change', () => {
        const size = parseInt(fontSizeSelect.value);
        if (!size) return;

        fontSizeInput.value = size;
        applyFontSize(size);
    });

    fontSizeInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            fontSizeInput.blur();
        }
    });

    fontSizeInput.addEventListener('blur', () => {
        let size = parseInt(fontSizeInput.value);
        if (!size) return;

        size = Math.min(72, Math.max(10, size));
        fontSizeInput.value = size;
        fontSizeSelect.value = size;

        applyFontSize(size);
    });

    editor.addEventListener('mouseup', syncFontSizeUI);
    editor.addEventListener('keyup', syncFontSizeUI);

    function syncFontSizeUI() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        let node = sel.anchorNode;
        if (node?.nodeType === 3) node = node.parentElement;
        if (!node) return;

        const size = parseFloat(getComputedStyle(node).fontSize);
        if (!size) return;

        fontSizeInput.value = Math.round(size);
        fontSizeSelect.value = Math.round(size);
    }

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
        const isDesktopModifier =
            (isMac && e.metaKey) || (!isMac && e.ctrlKey);

        // Desktop: Ctrl / Cmd + click
        if (isDesktopModifier) {
            e.preventDefault();
            window.open(link.href, '_blank');
            return;
        }

        // Mobile: double tap
        const now = Date.now();
        if (now - lastTapTime < 350) {
            e.preventDefault();
            window.open(link.href, '_blank');
        }
        lastTapTime = now;
    });

    // Mobile: long press (600ms)
    editor.addEventListener('touchstart', e => {
        const link = e.target.closest('a');
        if (!link) return;

        longPressTimer = setTimeout(() => {
            window.open(link.href, '_blank');
        }, 600);
    });

    editor.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
    });

    editor.addEventListener('touchmove', () => {
        clearTimeout(longPressTimer);
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

    // Undo/redo buttons

    undoBtn.onclick = () => {
        document.execCommand('undo');
        markDirty();
    };

    redoBtn.onclick = () => {
        document.execCommand('redo');
        markDirty();
    };

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

    function insertSmallHr() {
        const hr = document.createElement('hr');
        hr.style.border = 'none';
        hr.style.borderTop = '1px solid #e5e7eb';
        hr.style.margin = '12px auto';
        hr.style.width = '40%';

        insertAtCursor(hr);
        insertAtCursor(document.createElement('p'));

        markDirty();
        debounceAutoSave();
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

    function applyFontSize(sizePx) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        if (range.collapsed) return;

        const span = document.createElement('span');
        span.style.fontSize = `${sizePx}px`;

        try {
            range.surroundContents(span);
        } catch {
            // fallback for complex selections
            document.execCommand(
                'insertHTML',
                false,
                `<span style="font-size:${sizePx}px">${range.toString()}</span>`
            );
        }

        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.addRange(newRange);

        markDirty();
        debounceAutoSave();
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
            case 'z':
                e.preventDefault();
                if (e.shiftKey) document.execCommand('redo');
                else document.execCommand('undo');
                break;
            case 'y':
                e.preventDefault();
                document.execCommand('redo');
                break;
        }
    });

    window.addEventListener('online', () => {
        if (pendingOfflineSave) {
            pendingOfflineSave = false;
            saveDraft(true);
        }
    });

    // Hashtag

    function highlightHashtags(root) {
        if (!root) return;

        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    if (!node.parentElement) return NodeFilter.FILTER_REJECT;
                    if (node.parentElement.closest('a, .hashtag')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return /#[\w]+/.test(node.nodeValue)
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                }
            }
        );

        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);

        nodes.forEach(textNode => {
            const frag = document.createDocumentFragment();
            const parts = textNode.nodeValue.split(/(#[\w]+)/g);

            parts.forEach(part => {
                if (/^#[\w]+$/.test(part)) {
                    const span = document.createElement('span');
                    span.className = 'hashtag';
                    span.textContent = part;
                    frag.appendChild(span);
                } else {
                    frag.appendChild(document.createTextNode(part));
                }
            });

            textNode.parentNode.replaceChild(frag, textNode);
        });
    }

    editor.addEventListener('input', () => {
        highlightHashtags(editor);
    });
});