document.addEventListener('DOMContentLoaded', () => {
    const createPostBtn = document.getElementById('create-post-btn');
    const postsContainer = document.getElementById('posts-container');

    const backToTopButton = document.getElementById('back-to-top');
    const toBottomButton = document.getElementById('to-bottom');

    if (backToTopButton && toBottomButton) {
        // Calculate full document height for scrolling
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

        // Toggle navigation buttons based on scroll position
        window.addEventListener('scroll', () => {
            backToTopButton.classList.toggle('visible', window.scrollY > 300);

            const scrolledToBottom =
                window.scrollY + window.innerHeight > getDocHeight() - 200;
            toBottomButton.classList.toggle('visible', !scrolledToBottom);
        });

        // Set initial visibility state
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

    loadContent();

    async function loadContent() {
        postsContainer.innerHTML =
            '<div class="loading-posts">Loading content...</div>';

        try {
            const draftsSnapshot = await draftsCollection
                .orderBy('lastSaved', 'desc')
                .get();
            const postsSnapshot = await postsCollection
                .orderBy('date', 'desc')
                .get();

            postsContainer.innerHTML = '';

            if (!draftsSnapshot.empty) {
                const draftsHeader = document.createElement('h2');
                draftsHeader.className = 'section-heading';
                draftsHeader.textContent = 'Drafts';
                postsContainer.appendChild(draftsHeader);

                const draftsGrid = document.createElement('div');
                draftsGrid.className = 'posts-grid';
                postsContainer.appendChild(draftsGrid);

                draftsSnapshot.forEach(doc => {
                    draftsGrid.appendChild(
                        createDraftCard({ id: doc.id, ...doc.data() })
                    );
                });
            }

            const publishedHeader = document.createElement('h2');
            publishedHeader.className = 'section-heading';
            publishedHeader.textContent = 'Published Posts';
            postsContainer.appendChild(publishedHeader);

            if (postsSnapshot.empty) {
                const noPostsMessage = document.createElement('div');
                noPostsMessage.className = 'no-posts';
                noPostsMessage.textContent =
                    'No published posts yet. Click "Create Post" to get started!';
                postsContainer.appendChild(noPostsMessage);
            } else {
                const postsGrid = document.createElement('div');
                postsGrid.className = 'posts-grid';
                postsContainer.appendChild(postsGrid);

                postsSnapshot.forEach(doc => {
                    postsGrid.appendChild(
                        createPostCard({ id: doc.id, ...doc.data() })
                    );
                });
            }
        } catch (error) {
            console.error('Error fetching content:', error);
            postsContainer.innerHTML =
                '<div class="error-message">Failed to load content. Please refresh the page.</div>';
        }
    }

    function createDraftCard(draft) {
        const descriptionPreview = (draft.description || '').trim();
        const contentPreview = stripHtmlAndLimit(draft.content, 120);
        const previewText = descriptionPreview;

        const postCard = document.createElement('div');
        postCard.className = 'post-card draft';
        postCard.dataset.id = draft.id;

        postCard.innerHTML = `
            <div class="post-card-content">
                <h2>${draft.title || 'Untitled Draft'}</h2>
                ${previewText ? `<p>${previewText}</p>` : ``}
                <small>Last saved: ${formatDateTime(draft.lastSaved)}</small>
            </div>
            <div class="post-card-actions">
                <a class="action-btn edit" href="create.html?draftId=${draft.id}" title="Edit Draft" target="_blank">
                    <i class="fa-solid fa-pen-to-square"></i>
                </a>
                <button class="action-btn delete" title="Delete Draft">z
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;

        postCard.addEventListener('click', e => {
            if (e.target.closest('a, .action-btn')) return;
            window.location.href = `create.html?draftId=${draft.id}`;
        });

        postCard.querySelector('.delete').addEventListener('click', e => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this draft?')) {
                deleteDraft(draft.id);
            }
        });

        return postCard;
    }

    function createPostCard(post) {
        const descriptionPreview = (post.description || '').trim();
        const contentPreview = stripHtmlAndLimit(post.content, 120);
        const previewText = descriptionPreview;

        const postCard = document.createElement('div');
        postCard.className = 'post-card';
        postCard.dataset.id = post.id;

        postCard.innerHTML = `
            <div class="post-card-content">
                <h2>${post.title || 'Untitled'}</h2>
                ${previewText ? `<p>${previewText}</p>` : ``}
                <small>${formatDateTime(post.date)}</small>
            </div>
            <div class="post-card-actions">
                <a class="action-btn edit" href="create.html?id=${post.id}" title="Edit" target="_blank">
                    <i class="fa-solid fa-pen-to-square"></i>
                </a>
                <button class="action-btn delete" title="Delete">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;

        postCard.addEventListener('click', e => {
            if (e.target.closest('a, .action-btn')) return;
            window.location.href = `create.html?draftId=${draft.id}`;
        });

        postCard.querySelector('.delete').addEventListener('click', e => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this post?')) {
                deletePost(post.id);
            }
        });

        return postCard;
    }

    async function deletePost(postId) {
        try {
            await postsCollection.doc(postId).delete();
            loadContent();
        } catch (error) {
            console.error('Error deleting post:', error);
            alert('Failed to delete post. Please try again.');
        }
    }

    async function deleteDraft(draftId) {
        try {
            await draftsCollection.doc(draftId).delete();
            loadContent();
        } catch (error) {
            console.error('Error deleting draft:', error);
            alert('Failed to delete draft. Please try again.');
        }
    }

    function stripHtmlAndLimit(html, limit) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html || '';
        let text = tmp.textContent || tmp.innerText || '';

        if (text.length > limit) {
            text = text.substring(0, limit) + '...';
        }

        // wrap hashtags
        return text.replace(
            /(^|\s)(#[a-zA-Z0-9_]+)/g,
            '$1<span class="hashtag">$2</span>'
        );
    }

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
});