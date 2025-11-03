// socialify-frontend.js
// Full frontend script with comment moderation and robust image preview handling

const feed = document.getElementById("feed");
const postBtn = document.getElementById("postBtn");
const postText = document.getElementById("postText");
const postImage = document.getElementById("postImage");
const logoutBtn = document.getElementById("logoutBtn");
const ProfileBtn = document.getElementById("ProfileBtn");
// Note: we do NOT assume an #imagePreview exists on load; we will query it dynamically when needed.

let posts = JSON.parse(localStorage.getItem('socialify_posts')) || [];

// Helper to always get the current imagePreview element (may be created dynamically)
function getImagePreviewEl() {
  return document.getElementById('imagePreview');
}

// Add image preview functionality
postImage.addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (file) {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select a valid image file (JPEG, PNG, GIF, WebP, BMP)');
      postImage.value = '';
      hideImagePreview();
      return;
    }
    
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image size too large. Please select an image smaller than 10MB');
      postImage.value = '';
      hideImagePreview();
      return;
    }
    
    showImagePreview(file);
  } else {
    hideImagePreview();
  }
});

function showImagePreview(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    let previewEl = getImagePreviewEl();
    if (!previewEl) {
      // Create preview container if it doesn't exist
      const previewContainer = document.createElement('div');
      previewContainer.id = 'imagePreview';
      previewContainer.className = 'image-preview';
      previewContainer.innerHTML = `
        <img src="${e.target.result}" alt="Preview">
        <button type="button" class="remove-image" title="Remove image">×</button>
      `;
      postImage.parentNode.appendChild(previewContainer);
      
      // Add remove functionality
      previewContainer.querySelector('.remove-image').addEventListener('click', function() {
        // clear file input and remove preview element
        postImage.value = '';
        hideImagePreview();
      });
    } else {
      previewEl.innerHTML = `
        <img src="${e.target.result}" alt="Preview">
        <button type="button" class="remove-image" title="Remove image">×</button>
      `;
      previewEl.style.display = 'block';
      // rebind the remove button
      const removeBtn = previewEl.querySelector('.remove-image');
      if (removeBtn) {
        removeBtn.addEventListener('click', function() {
          postImage.value = '';
          hideImagePreview();
        });
      }
    }
  };
  reader.onerror = function() {
    console.error('Error reading file');
    hideImagePreview();
  };
  reader.readAsDataURL(file);
}

function hideImagePreview() {
  const el = getImagePreviewEl();
  if (el) {
    // remove entirely to keep DOM consistent with initial state
    el.remove();
  }
}

// Button click to create a post (with moderation)
postBtn.addEventListener("click", async () => {
  const text = postText.value.trim();
  const imageFile = postImage.files[0];

  if (text === "" && !imageFile) {
    alert("Write something or upload an image to post.");
    return;
  }

  // Show loading state
  const originalText = postBtn.textContent;
  postBtn.textContent = "🔄 Analyzing...";
  postBtn.disabled = true;

  try {
    // Test backend connection first
    const isBackendAlive = await testBackendConnection();
    if (!isBackendAlive) {
      // If backend is down, allow posting without moderation
      console.log("⚠️ Backend offline - posting without moderation");
      await createAndSavePost(text, imageFile, null);
      return;
    }

    const formData = new FormData();
    if (text) formData.append('text', text);
    if (imageFile) formData.append('image', imageFile);

    console.log("📤 Sending post for moderation...");
    
    const response = await fetch("http://localhost:5000/api/moderate/post", {
      method: "POST",
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log("📥 Response status:", response.status);

    if (!response.ok) {
      let errorMessage = `Server error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("✅ Moderation result:", result);

    if (result.isOffensive) {
      let warningMessage = `🚫 Your post contains inappropriate content!\n\n`;
      warningMessage += `Reason: ${result.label}\n`;
      warningMessage += `Confidence: ${(result.confidence * 100).toFixed(1)}%\n\n`;
      
      if (result.details?.textModeration?.isOffensive) {
        warningMessage += `📝 Offensive text detected\n`;
      }
      if (result.details?.imageAnalysis?.isOffensive) {
        warningMessage += `📸 Inappropriate image content\n`;
      }
      if (result.extractedText) {
        const shortText = result.extractedText.length > 50 
          ? result.extractedText.substring(0, 50) + '...' 
          : result.extractedText;
        warningMessage += `📸 Text in image: "${shortText}"\n`;
      }
      
      warningMessage += `\nPlease remove the offensive content and try again.`;
      
      showWarningPopup(warningMessage);
      return;
    }

    // If post is NOT offensive, create and save it
    console.log("✅ Post is clean - creating post...");
    await createAndSavePost(text, imageFile, result);
    
  } catch (err) {
    console.error("❌ Moderation error details:", err);
    
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('moderation server')) {
      console.log("⚠️ Backend connection failed - posting without moderation");
      // If backend fails, allow posting without moderation
      await createAndSavePost(text, imageFile, null);
    } else {
      showErrorPopup("❌ Unable to check content: " + err.message);
    }
  } finally {
    // Restore button state
    postBtn.textContent = originalText;
    postBtn.disabled = false;
  }
});

// NEW FUNCTION: Create and save post (separated for clarity)
async function createAndSavePost(text, imageFile, moderationResult) {
  try {
    console.log("📝 Creating new post...");
    
    const post = {
      id: Date.now(),
      username: "User_" + Math.floor(Math.random() * 1000),
      text: text,
      image: imageFile ? await getImagePreview(imageFile) : null,
      imageFile: imageFile ? {
        name: imageFile.name,
        size: imageFile.size,
        type: imageFile.type
      } : null,
      likes: 0,
      comments: [], // each comment: { text, username, timestamp, moderated, moderationResult }
      liked: false,
      timestamp: new Date().toLocaleString(),
      moderated: !!moderationResult, // true if moderation was done, false if backend was down
      moderationResult: moderationResult
    };

    console.log("💾 Saving post:", post);
    
    // Add to beginning of posts array
    posts.unshift(post);
    savePosts();
    
    console.log("🔄 Rendering feed...");
    renderFeed();
    
    // Clear the form
    clearPostForm();
    hideImagePreview();
    
    showSuccessPopup("✅ Post published successfully!" + (moderationResult ? " Content checked for safety." : " (Posted without content check - server offline)"));
    
  } catch (error) {
    console.error("❌ Error creating post:", error);
    showErrorPopup("❌ Failed to create post: " + error.message);
  }
}

// Helper function to create image preview data URL (for storage)
function getImagePreview(imageFile) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(imageFile);
  });
}

// Helper: send text to moderation endpoint (re-usable for comments)
async function moderateTextOnServer(text) {
  try {
    const form = new FormData();
    form.append('text', text);
    const resp = await fetch('http://localhost:5000/api/moderate/post', {
      method: 'POST',
      body: form,
      headers: { 'Accept': 'application/json' }
    });
    if (!resp.ok) {
      console.warn('Moderation server responded with non-OK', resp.status);
      return null;
    }
    const json = await resp.json();
    return json;
  } catch (err) {
    console.warn('Moderation server unreachable:', err);
    return null;
  }
}

function renderFeed() {
  if (!feed) {
    console.error('Feed element not found');
    return;
  }

  console.log(`🔄 Rendering ${posts.length} posts`);
  
  feed.innerHTML = "";

  if (posts.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <p>No posts yet. Create your first one!</p>
        <small>All posts are checked for inappropriate content</small>
      </div>
    `;
    return;
  }

  posts.forEach((post, index) => {
    console.log(`📄 Rendering post ${index + 1}:`, post.text || 'Image post');
    
    const card = document.createElement("div");
    card.classList.add("post-card");

    card.innerHTML = `
      <div class="post-header">
        <div class="user-avatar">${post.username[0]}</div>
        <div>
          <div class="username">${post.username}</div>
          <div class="post-time">${post.timestamp}</div>
          ${post.moderated ? '<div class="moderation-badge">✅ Moderated</div>' : '<div class="moderation-badge">⚠️ Not Checked</div>'}
        </div>
      </div>
      ${post.text ? `<div class="post-text">${escapeHtml(post.text)}</div>` : ''}
      ${post.image ? `
        <div class="post-image-container">
          <img src="${post.image}" class="post-image" alt="Post image" loading="lazy">
          <div class="image-safe-badge">${post.moderated ? '✅ Content Checked' : '⚠️ Not Checked'}</div>
          ${post.imageFile ? `<div class="image-info">${escapeHtml(post.imageFile.name)} (${formatFileSize(post.imageFile.size)})</div>` : ''}
        </div>
      ` : ""}
      <div class="post-actions">
        <button class="action-btn like-btn">${post.liked ? "❤️" : "🤍"} <span class="like-count">${post.likes}</span></button>
        <button class="action-btn comment-btn">💬 ${post.comments.length}</button>
        <button class="action-btn delete-btn">🗑️ Delete</button>
      </div>
      <div class="comment-section"></div>
      <input type="text" placeholder="Add a comment..." class="comment-input">
    `;

    const likeBtn = card.querySelector(".like-btn");
    const commentInput = card.querySelector(".comment-input");
    const commentSection = card.querySelector(".comment-section");
    const deleteBtn = card.querySelector(".delete-btn");

    likeBtn.addEventListener("click", () => {
      post.liked = !post.liked;
      post.likes += post.liked ? 1 : -1;
      savePosts();
      renderFeed();
    });

    deleteBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to delete this post?")) {
        posts = posts.filter(p => p.id !== post.id);
        savePosts();
        renderFeed();
        showSuccessPopup("Post deleted successfully!");
      }
    });

    // COMMENT POSTING: moderate comment text before saving
    commentInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter" && commentInput.value.trim() !== "") {
        const commentText = commentInput.value.trim();

        // Check backend
        const backendAlive = await testBackendConnection();
        if (!backendAlive) {
          // Backend down: allow posting but mark as not moderated
          post.comments.push({
            text: commentText,
            username: "User_" + Math.floor(Math.random() * 1000),
            timestamp: new Date().toLocaleTimeString(),
            moderated: false,
            moderationResult: null
          });
          commentInput.value = "";
          savePosts();
          renderFeed();
          return;
        }

        // Backend up: moderate via server
        try {
          commentInput.disabled = true;
          const modResult = await moderateTextOnServer(commentText);
          commentInput.disabled = false;

          if (modResult && modResult.isOffensive) {
            // block comment and show warning
            let warningMessage = `🚫 Your comment contains inappropriate content!\n\n`;
            warningMessage += `Reason: ${modResult.label}\n`;
            warningMessage += `Confidence: ${(modResult.confidence * 100).toFixed(1)}%\n\n`;
            warningMessage += `Please remove the offensive content and try again.`;
            showWarningPopup(warningMessage);
            return;
          }

          // not offensive or moderation result null (server returned null -> treat as allowed but unmoderated)
          post.comments.push({
            text: commentText,
            username: "User_" + Math.floor(Math.random() * 1000),
            timestamp: new Date().toLocaleTimeString(),
            moderated: !!modResult,
            moderationResult: modResult
          });
          commentInput.value = "";
          savePosts();
          renderFeed();
        } catch (err) {
          console.error("Error moderating comment:", err);
          // fallback: allow comment and mark as not moderated
          post.comments.push({
            text: commentText,
            username: "User_" + Math.floor(Math.random() * 1000),
            timestamp: new Date().toLocaleTimeString(),
            moderated: false,
            moderationResult: null
          });
          commentInput.value = "";
          savePosts();
          renderFeed();
        }
      }
    });

    // Render existing comments
    if (post.comments && post.comments.length > 0) {
      post.comments.forEach((comment) => {
        const commentElement = document.createElement("div");
        commentElement.classList.add("comment");
        commentElement.innerHTML = `
          <div>
            <strong>${comment.username}:</strong> ${escapeHtml(comment.text)}
            ${comment.moderated ? '<span class="comment-moderation"> <small>✅ Checked</small></span>' : '<span class="comment-moderation"> <small>⚠️ Not checked</small></span>'}
          </div>
          <span class="comment-time">${comment.timestamp}</span>
        `;
        commentSection.appendChild(commentElement);
      });
    }

    feed.appendChild(card);
  });
  
  console.log("✅ Feed rendered successfully");
}

// small helper to escape user-provided HTML (prevents accidental injection)
function escapeHtml(unsafe) {
  if (!unsafe && unsafe !== "") return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function savePosts() {
  try {
    localStorage.setItem('socialify_posts', JSON.stringify(posts));
    console.log(`💾 Saved ${posts.length} posts to localStorage`);
  } catch (error) {
    console.error('Error saving posts to localStorage:', error);
    showErrorPopup('Error saving posts. Local storage might be full.');
  }
}

// Popup functions
function showWarningPopup(message) {
  showPopup(message, 'warning');
}

function showSuccessPopup(message) {
  showPopup(message, 'success');
}

function showErrorPopup(message) {
  showPopup(message, 'error');
}

function showPopup(message, type = 'info') {
  const popup = document.createElement("div");
  popup.className = "popup-overlay";
  popup.innerHTML = `
    <div class="popup-box ${type}-box">
      <h3>${type === 'warning' ? '🚫 Content Blocked' : type === 'success' ? '✅ Success' : '❌ Error'}</h3>
      <p>${message.replace(/\n/g, '<br>')}</p>
      <button class="popup-close-btn">OK</button>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  const closeBtn = popup.querySelector(".popup-close-btn");
  closeBtn.addEventListener("click", () => popup.remove());
  
  // Auto-remove after 5 seconds for success messages
  if (type === 'success') {
    setTimeout(() => {
      if (popup.parentNode) {
        popup.remove();
      }
    }, 5000);
  }
}

// Clear form function
function clearPostForm() {
  postText.value = "";
  postImage.value = "";
  hideImagePreview();
  console.log("🧹 Form cleared");
}

// Test backend connection
async function testBackendConnection() {
  try {
    const response = await fetch('http://localhost:5000/api/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend connection successful:', data);
      return true;
    } else {
      console.error('❌ Backend health check failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Backend connection failed:', error);
    return false;
  }
}

logoutBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to logout?")) {
    window.location.href = "login_page.html";
  }
});

ProfileBtn.addEventListener("click", () => {
    window.location.href= "profile.html";
});
// Initialize
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Socialify frontend initialized');
  testBackendConnection();
  renderFeed();
});
