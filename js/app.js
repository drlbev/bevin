document.addEventListener('DOMContentLoaded', () => {
    const createPostBtn = document.getElementById('create-post-btn');
    const postsContainer = document.getElementById('posts-container');

    // Get the navigation buttons
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
    
    // Event listener for create post button
    createPostBtn.addEventListener('click', () => {
        window.location.href = 'create.html';
    });
    
    // Load and display posts and drafts from Firebase
    loadContent();
    
    async function loadContent() {
        // Show loading state
        postsContainer.innerHTML = '<div class="loading-posts">Loading content...</div>';
        
        try {
            // Get drafts
            const draftsSnapshot = await draftsCollection.orderBy('lastSaved', 'desc').get();
            
            // Get published posts
            const postsSnapshot = await postsCollection.orderBy('date', 'desc').get();
            
            // Clear container
            postsContainer.innerHTML = '';
            
            // First add drafts section if there are any drafts
            if (!draftsSnapshot.empty) {
                const draftsHeader = document.createElement('h2');
                draftsHeader.className = 'section-heading';
                draftsHeader.textContent = 'Drafts';
                postsContainer.appendChild(draftsHeader);
                
                const draftsGrid = document.createElement('div');
                draftsGrid.className = 'posts-grid';
                postsContainer.appendChild(draftsGrid);
                
                // Display each draft
                draftsSnapshot.forEach(doc => {
                    const draft = { id: doc.id, ...doc.data() };
                    const draftCard = createDraftCard(draft);
                    draftsGrid.appendChild(draftCard);
                });
            }
            
            // Add published posts section
            const publishedHeader = document.createElement('h2');
            publishedHeader.className = 'section-heading';
            publishedHeader.textContent = 'Published Posts';
            postsContainer.appendChild(publishedHeader);
            
            if (postsSnapshot.empty) {
                const noPostsMessage = document.createElement('div');
                noPostsMessage.className = 'no-posts';
                noPostsMessage.textContent = 'No published posts yet. Click "Create Post" to get started!';
                postsContainer.appendChild(noPostsMessage);
            } else {
                const postsGrid = document.createElement('div');
                postsGrid.className = 'posts-grid';
                postsContainer.appendChild(postsGrid);
                
                // Display each post
                postsSnapshot.forEach(doc => {
                    const post = { id: doc.id, ...doc.data() };
                    const postCard = createPostCard(post);
                    postsGrid.appendChild(postCard);
                });
            }
        } catch (error) {
            console.error("Error fetching content:", error);
            postsContainer.innerHTML = '<div class="error-message">Failed to load content. Please refresh the page.</div>';
        }
    }
    
    function createDraftCard(draft) {
        const postCard = document.createElement('div');
        postCard.className = 'post-card draft';
        postCard.dataset.id = draft.id;
        
        // Create a content preview
        const contentPreview = stripHtmlAndLimit(draft.content, 120);
        
        postCard.innerHTML = `
            <div class="post-card-content">
                <h2>${draft.title || 'Untitled Draft'}</h2>
                <p>${contentPreview || 'No content'}</p>
                <small>Last saved: ${formatDate(draft.lastSaved)}</small>
            </div>
            <div class="post-card-actions">
                <button class="action-btn edit" title="Edit Draft">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="action-btn delete" title="Delete Draft">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        
        // Add event listeners for card click
        postCard.addEventListener('click', (e) => {
            if (!e.target.closest('.action-btn')) {
                window.location.href = `create.html?draftId=${draft.id}`;
            }
        });
        
        // Add event listeners for edit and delete buttons
        const editBtn = postCard.querySelector('.edit');
        const deleteBtn = postCard.querySelector('.delete');
        
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `create.html?draftId=${draft.id}`;
        });
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this draft?')) {
                deleteDraft(draft.id);
            }
        });
        
        return postCard;
    }
    
    function createPostCard(post) {
        const postCard = document.createElement('div');
        postCard.className = 'post-card';
        postCard.dataset.id = post.id;
        
        // Create a content preview (strip HTML and limit length)
        const contentPreview = stripHtmlAndLimit(post.content, 120);
        
        postCard.innerHTML = `
            <div class="post-card-content">
                <h2>${post.title || 'Untitled'}</h2>
                <p>${contentPreview}</p>
                <small>${formatDate(post.date)}</small>
            </div>
            <div class="post-card-actions">
                <button class="action-btn edit" title="Edit">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="action-btn delete" title="Delete">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        
        // Add event listener for post card click (to view post)
        postCard.addEventListener('click', (e) => {
            // Don't navigate if clicked on action buttons
            if (!e.target.closest('.action-btn')) {
                window.open(`view.html?id=${post.id}`, '_blank');
            }
        });
        
        // Add event listeners for edit and delete buttons
        const editBtn = postCard.querySelector('.edit');
        const deleteBtn = postCard.querySelector('.delete');
        
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `create.html?id=${post.id}`;
        });
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this post?')) {
                deletePost(post.id);
            }
        });
        
        return postCard;
    }
    
    async function deletePost(postId) {
        try {
            // Delete from Firebase
            await postsCollection.doc(postId).delete();
            
            // Refresh the content display
            loadContent();
        } catch (error) {
            console.error("Error deleting post:", error);
            alert("Failed to delete post. Please try again.");
        }
    }
    
    async function deleteDraft(draftId) {
        try {
            // Delete from Firebase
            await draftsCollection.doc(draftId).delete();
            
            // Refresh the content display
            loadContent();
        } catch (error) {
            console.error("Error deleting draft:", error);
            alert("Failed to delete draft. Please try again.");
        }
    }
    
    function stripHtmlAndLimit(html, limit) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html || '';
        let text = tmp.textContent || tmp.innerText || '';
        
        if (text.length > limit) {
            return text.substring(0, limit) + '...';
        }
        return text;
    }
    
    function formatDate(timestamp) {
        // Firebase timestamps can be Timestamp objects or ISO strings
        let date;
        if (timestamp && timestamp.toDate) {
            date = timestamp.toDate(); // Convert Firestore Timestamp to Date
        } else if (timestamp) {
            date = new Date(timestamp);
        } else {
            date = new Date();
        }
        
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
});