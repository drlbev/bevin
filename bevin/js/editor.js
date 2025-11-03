document.addEventListener('DOMContentLoaded', () => {
    // Navigation buttons functionality
    const backToTopButton = document.getElementById('back-to-top');
    const toBottomButton = document.getElementById('to-bottom');

    if (backToTopButton && toBottomButton) {
        // Calculate document height (for to-bottom button)
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
        
        // Show the appropriate buttons based on scroll position
        window.addEventListener('scroll', function() {
            // Show back-to-top when scrolled down
            if (window.scrollY > 300) {
                backToTopButton.classList.add('visible');
            } else {
                backToTopButton.classList.remove('visible');
            }
            
            // Show to-bottom when not at bottom
            const scrolledToBottom = window.scrollY + window.innerHeight > getDocHeight() - 200;
            if (!scrolledToBottom) {
                toBottomButton.classList.add('visible');
            } else {
                toBottomButton.classList.remove('visible');
            }
        });
        
        // Trigger scroll event to set initial state
        window.dispatchEvent(new Event('scroll'));
        
        // Scroll to top when back-to-top is clicked
        backToTopButton.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
        
        // Scroll to bottom when to-bottom is clicked
        toBottomButton.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo({
                top: getDocHeight(),
                behavior: 'smooth'
            });
        });
    }

    const titleInput = document.getElementById('post-title');
    const editor = document.getElementById('editor');
    
    // Format buttons
    const boldBtn = document.getElementById('bold-btn');
    const italicBtn = document.getElementById('italic-btn');
    const underlineBtn = document.getElementById('underline-btn');
    const hrBtn = document.getElementById('hr-btn');
    const decreaseFontBtn = document.getElementById('decrease-font-btn');  
    const increaseFontBtn = document.getElementById('increase-font-btn');
    const alignLeftBtn = document.getElementById('align-left-btn');
    const alignCenterBtn = document.getElementById('align-center-btn');
    const alignRightBtn = document.getElementById('align-right-btn');
    
    // Media upload buttons
    const uploadImageBtn = document.getElementById('upload-image-btn');
    const uploadVideoBtn = document.getElementById('upload-video-btn');
    const fileInput = document.getElementById('file-input');
    
    // Action buttons
    const saveDraftBtn = document.getElementById('save-draft-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const publishBtn = document.getElementById('publish-btn');
    
    let isEditing = false;
    let currentPostId = null;
    let isDraft = false;
    
    // Array for temporary images
    let tempImages = [];

    // Create save confirmation element
    const saveConfirmation = document.createElement('div');
    saveConfirmation.className = 'save-confirmation';
    saveConfirmation.innerHTML = `<i class="fa-solid fa-check-circle"></i> Draft saved successfully!`;
    document.body.appendChild(saveConfirmation);
    
    // Check if we're editing an existing post
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
        // For new posts, generate a temporary ID
        currentPostId = 'new_' + Date.now();
    }
    
    // Initialize editor with a paragraph
    if (editor.innerHTML.trim() === '') {
        editor.innerHTML = '<p><br></p>';
    }
    
    // Text formatting event listeners
    boldBtn.addEventListener('click', () => {
        document.execCommand('bold', false, null);
        toggleActiveState(boldBtn);
        editor.focus();
    });
    
    italicBtn.addEventListener('click', () => {
        document.execCommand('italic', false, null);
        toggleActiveState(italicBtn);
        editor.focus();
    });
    
    underlineBtn.addEventListener('click', () => {
        document.execCommand('underline', false, null);
        toggleActiveState(underlineBtn);
        editor.focus();
    });

    hrBtn.addEventListener('click', () => {
        document.execCommand('insertHorizontalRule', false, null);
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
    
    // Text alignment event listeners
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
    
    // Check formatting state on selection change
    editor.addEventListener('mouseup', updateToolbarState);
    editor.addEventListener('keyup', updateToolbarState);
    
    // File upload event listeners
    uploadImageBtn.addEventListener('click', () => {
        fileInput.setAttribute('accept', 'image/*');
        fileInput.click();
    });
    
    uploadVideoBtn.addEventListener('click', () => {
        fileInput.setAttribute('accept', 'video/*');
        fileInput.click();
    });
    
    // Handle file selection
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.type.includes('image')) {
            // For images, use the delayed upload approach
            const tempUrl = await readFileAsDataURL(file);
            insertTempImage(tempUrl, file);
        } else if (file.type.includes('video')) {
            try {
                // For videos, still upload immediately (videos are harder to handle as temp data)
                const loadingPlaceholder = document.createElement('div');
                loadingPlaceholder.className = 'loading-placeholder';
                loadingPlaceholder.textContent = 'Uploading video...';
                insertAtCursor(loadingPlaceholder);
                
                // Extract numeric post ID for folder path
                let postFolderId = getPostFolderId();
                
                // Upload to Cloudinary with post ID
                const url = await uploadToCloudinary(file, postFolderId);
                
                // Remove loading placeholder
                loadingPlaceholder.remove();
                
                // Insert video into editor
                insertVideo(url);
            } catch (error) {
                console.error('Upload failed:', error);
                alert('Failed to upload video. Please try again.');
            }
        }
        
        // Clear the input to allow selecting the same file again
        fileInput.value = '';
    });
    
    // Handle paste events for images - UPDATED for faster pasting
    editor.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        
        for (const item of items) {
            if (item.type.indexOf('image') === 0) {
                e.preventDefault();
                const blob = item.getAsFile();
                
                // Instead of uploading, read as data URL and insert immediately
                readFileAsDataURL(blob).then(dataUrl => {
                    insertTempImage(dataUrl, blob);
                }).catch(error => {
                    console.error('Error processing pasted image:', error);
                });
                
                return;
            }
        }
    });
    
    // Ensure proper paragraph structure when pressing Enter
    editor.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            // Get current selection
            const selection = window.getSelection();
            if (selection.rangeCount) {
                const range = selection.getRangeAt(0);
                let node = range.startContainer;
                
                // Navigate up to find if we're in a paragraph
                while (node && node !== editor) {
                    if (node.nodeName === 'P') {
                        // We're already in a paragraph, let the browser handle it
                        return;
                    }
                    node = node.parentNode;
                }
                
                // Not in a paragraph, prevent default and insert a new paragraph
                e.preventDefault();
                document.execCommand('insertParagraph', false, null);
            }
        }
    });
    
    // Button event listeners
    cancelBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to cancel? Your changes will be lost.')) {
            window.location.href = 'index.html';
        }
    });
    
    publishBtn.addEventListener('click', async () => {
        // Show loading state
        publishBtn.disabled = true;
        publishBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...';
        
        // Process all temporary images before publishing
        try {
            await processTemporaryImages();
            publishPost();
        } catch (error) {
            console.error('Error during publishing:', error);
            alert('There was an error publishing your post. Please try again.');
            publishBtn.disabled = false;
            publishBtn.innerHTML = `
                <i class="fa-solid fa-paper-plane"></i>
                Publish
            `;
        }
    });
    
    // Helper Functions
    
    // Function to read a file as data URL
    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }
    
    // Function to insert a temporary image with a data URL
    function insertTempImage(dataUrl, originalFile) {
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = 'User uploaded image';
        
        // Add a special class and data attribute to identify it as a temp image
        img.classList.add('temp-image');
        
        // Generate a unique ID for this temporary image
        const tempId = 'temp-img-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        img.dataset.tempId = tempId;
        
        // Store the original file for later upload
        tempImages.push({
            id: tempId,
            file: originalFile,
            element: img
        });
        
        // Insert the image at cursor position
        insertAtCursor(img);
        
        // Insert a line break after the image for spacing
        const br = document.createElement('br');
        insertAtCursor(br);
    }
    
    // Function to process all temporary images before publishing
    async function processTemporaryImages() {
        // If there are no temporary images, return immediately
        if (tempImages.length === 0) {
            return;
        }
        
        // Get post folder ID for uploads
        const postFolderId = getPostFolderId();
        
        // Process each temporary image
        for (const tempImage of tempImages) {
            try {
                // Upload the image to Cloudinary
                const cloudinaryUrl = await uploadToCloudinary(tempImage.file, postFolderId);
                
                // Replace the data URL with the Cloudinary URL in the image element
                tempImage.element.src = cloudinaryUrl;
                
                // Remove the temporary class and data attribute
                tempImage.element.classList.remove('temp-image');
                tempImage.element.removeAttribute('data-temp-id');
            } catch (error) {
                console.error('Error uploading image during publish:', error);
                // Continue with the next image rather than stopping the whole process
            }
        }
        
        // Clear the temporary images array
        tempImages = [];
    }
    
    // Function to get the post folder ID for Cloudinary
    function getPostFolderId() {
        let postFolderId = currentPostId;
        if (currentPostId.startsWith('post_')) {
            // Extract just the numeric part for existing posts
            postFolderId = currentPostId.split('_')[1];
        } else if (currentPostId.startsWith('new_')) {
            // For new posts, use a temporary ID
            postFolderId = 'temp_' + currentPostId.split('_')[1];
        }
        return postFolderId;
    }
    
    // Functions for formatting
    function formatAlignment(align) {
        // Get current selection
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        // Get the selected node or parent paragraph
        const range = selection.getRangeAt(0);
        let containerNode = range.commonAncestorContainer;
        
        // Navigate up to find the paragraph containing the selection
        if (containerNode.nodeType === Node.TEXT_NODE) {
            containerNode = containerNode.parentNode;
        }
        
        // Find the nearest block-level element
        while (containerNode !== editor && !isBlockElement(containerNode)) {
            containerNode = containerNode.parentNode;
        }
        
        // If we didn't find a block element or hit the editor, wrap selection in a new paragraph
        if (containerNode === editor) {
            document.execCommand('formatBlock', false, 'p');
            
            // Get the newly created paragraph
            const newSelection = window.getSelection();
            if (newSelection.rangeCount > 0) {
                const newRange = newSelection.getRangeAt(0);
                let newContainer = newRange.commonAncestorContainer;
                
                if (newContainer.nodeType === Node.TEXT_NODE) {
                    newContainer = newContainer.parentNode;
                }
                
                while (newContainer !== editor && !isBlockElement(newContainer)) {
                    newContainer = newContainer.parentNode;
                }
                
                if (isBlockElement(newContainer)) {
                    containerNode = newContainer;
                }
            }
        }
        
        // Set the alignment on the container node
        if (containerNode !== editor && isBlockElement(containerNode)) {
            // Remove existing alignment
            containerNode.removeAttribute('data-align');
            
            // Apply new alignment
            if (align !== 'left') {
                containerNode.setAttribute('data-align', align);
            }
            
            // Apply inline style for immediate feedback
            containerNode.style.textAlign = align;
        }
    }
    
    function isBlockElement(node) {
        const blockElements = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE'];
        return blockElements.includes(node.nodeName);
    }
    
    function toggleActiveState(button) {
        button.classList.toggle('active');
    }
    
    function setActiveAlignButton(activeButton) {
        const alignButtons = [alignLeftBtn, alignCenterBtn, alignRightBtn];
        alignButtons.forEach(btn => btn.classList.remove('active'));
        activeButton.classList.add('active');
    }
    
    function updateToolbarState() {
        // Update button active states based on current selection formatting
        setTimeout(() => {
            // Text formatting
            boldBtn.classList.toggle('active', document.queryCommandState('bold'));
            italicBtn.classList.toggle('active', document.queryCommandState('italic'));
            underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
            
            // Alignment - need to check the containing block element
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                let containerNode = range.commonAncestorContainer;
                
                if (containerNode.nodeType === Node.TEXT_NODE) {
                    containerNode = containerNode.parentNode;
                }
                
                // Find the closest block element
                while (containerNode !== editor && !isBlockElement(containerNode)) {
                    containerNode = containerNode.parentNode;
                }
                
                if (containerNode !== editor) {
                    const align = containerNode.getAttribute('data-align') || 'left';
                    alignLeftBtn.classList.toggle('active', align === 'left');
                    alignCenterBtn.classList.toggle('active', align === 'center');
                    alignRightBtn.classList.toggle('active', align === 'right');
                }
            }
        }, 0);
    }

    function adjustFontSize(delta) {
        const currentSize = parseInt(document.queryCommandValue('fontSize')) || 3;  
        const newSize = Math.max(1, Math.min(7, currentSize + delta));  
        document.execCommand('fontSize', false, newSize.toString());
    }
    
    // Functions for media insertion
    function insertAtCursor(element) {
        editor.focus();
        const selection = window.getSelection();
        
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.insertNode(element);
            range.setStartAfter(element);
            range.setEndAfter(element);
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
        video.autoplay = false;
        
        insertAtCursor(video);
        
        // Insert a line break after the video for spacing
        const br = document.createElement('br');
        insertAtCursor(br);
    }

    // Add Save Draft button event listener
    saveDraftBtn.addEventListener('click', async () => {
        // Disable button to prevent multiple clicks
        saveDraftBtn.disabled = true;
        saveDraftBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
        
        try {
            await saveDraft();
            
            // Show confirmation
            saveConfirmation.classList.add('show');
            setTimeout(() => {
                saveConfirmation.classList.remove('show');
            }, 3000);
        } catch (error) {
            console.error('Error saving draft:', error);
            alert('Failed to save draft. Please try again.');
        } finally {
            // Re-enable button
            saveDraftBtn.disabled = false;
            saveDraftBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Draft`;
        }
    });

    // Add saveDraft function
    async function saveDraft() {
        const title = titleInput.value.trim();
        const content = editor.innerHTML;
        
        // We allow empty drafts to be saved
        const draftData = {
            title,
            content,
            lastSaved: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (isDraft && currentPostId) {
            // Update existing draft
            await draftsCollection.doc(currentPostId).update(draftData);
        } else {
            // Create new draft
            const docRef = await draftsCollection.add(draftData);
            currentPostId = docRef.id;
            isDraft = true;
            
            // Update URL without reloading the page
            const newUrl = `create.html?draftId=${currentPostId}`;
            window.history.pushState({ path: newUrl }, '', newUrl);
        }
        
        return true;
    }
    
    // Post management functions
    async function loadPostForEditing(id, isDraftPost) {
        try {
            // Choose the right collection based on whether it's a draft
            const collection = isDraftPost ? draftsCollection : postsCollection;
            const doc = await collection.doc(id).get();
            
            if (doc.exists) {
                const post = doc.data();
                isEditing = true;
                currentPostId = id;
                isDraft = isDraftPost;
                
                // Fill the form with post data
                titleInput.value = post.title || '';
                editor.innerHTML = post.content || '';
                
                // Update button text
                if (isDraftPost) {
                    publishBtn.innerHTML = `
                        <i class="fa-solid fa-paper-plane"></i>
                        Publish Draft
                    `;
                } else {
                    publishBtn.innerHTML = `
                        <i class="fa-solid fa-floppy-disk"></i>
                        Update Post
                    `;
                }
                
                // Update toolbar states
                updateToolbarState();
            } else {
                alert(isDraftPost ? 'Draft not found!' : 'Post not found!');
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error("Error loading post:", error);
            alert("Failed to load post. Please try again.");
            window.location.href = 'index.html';
        }
    }

    async function publishPost() {
        const title = titleInput.value.trim();
        const content = editor.innerHTML;
        
        if (content.trim() === '' || content === '<p><br></p>') {
            alert('Please add some content to your post.');
            publishBtn.disabled = false;
            publishBtn.innerHTML = `
                <i class="fa-solid fa-paper-plane"></i>
                Publish
            `;
            return;
        }
        
        try {
            // Prepare the post data
            const postData = {
                title,
                content,
                date: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (isEditing && !isDraft && currentPostId) {
                // Update existing published post
                await postsCollection.doc(currentPostId).update({
                    title,
                    content,
                    lastEdited: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Create a new post in the posts collection
                const docRef = await postsCollection.add(postData);
                
                // If it was a draft, delete it from drafts collection
                if (isDraft && currentPostId) {
                    await draftsCollection.doc(currentPostId).delete();
                }
            }
            
            // Redirect back to home page
            window.location.href = 'index.html';
        } catch (error) {
            console.error("Error publishing post:", error);
            alert("Failed to publish post. Please try again.");
            publishBtn.disabled = false;
            
            // Update button text based on context
            if (isDraft) {
                publishBtn.innerHTML = `
                    <i class="fa-solid fa-paper-plane"></i>
                    Publish Draft
                `;
            } else if (isEditing) {
                publishBtn.innerHTML = `
                    <i class="fa-solid fa-floppy-disk"></i>
                    Update Post
                `;
            } else {
                publishBtn.innerHTML = `
                    <i class="fa-solid fa-paper-plane"></i>
                    Publish
                `;
            }
        }
    }
});