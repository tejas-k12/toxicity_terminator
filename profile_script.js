const username = document.getElementById("username");
const bio = document.getElementById("bio");
const editBioBtn = document.getElementById("editBioBtn");
const postsGrid = document.getElementById("postsGrid");
const postsCount = document.getElementById("postsCount");
const uploadPhoto = document.getElementById("uploadPhoto");
const profilePhoto = document.getElementById("profilePhoto");
const editPhotoBtn = document.getElementById("editPhotoBtn");
const backToFeed = document.getElementById("backToFeed");

// Sample data
let posts = [
  {
    id: 1,
    text: "mera landu dost! 💻🔥",
    image: "post_1.jpg",
    likes: 24,
    comments: ["Nice!", "Awesome work!", "Keep it up!"],
  },
  {
    id: 2,
    text: "A beautiful morning ☀️🌿",
    image: "post_2.jpg",
    likes: 12,
    comments: ["Lovely view!", "Good vibes only."],
  },
  {
    id: 3,
    text: "Pic with JP ☀️",
    image: "post_3.jpg",
    likes: 12,
    comments: ["Lovely view!", "Good vibes only."],
  },
  {
    id: 4,
    text: "A beautiful night🌿",
    image: "post_4.jpg",
    likes: 12,
    comments: ["Lovely view!", "Good vibes only."],
  },
];

// Render posts grid
function renderPosts() {
  postsGrid.innerHTML = "";
  posts.forEach((p) => {
    const postCard = document.createElement("div");
    postCard.classList.add("post-card");

    postCard.innerHTML = `
      <img src="${p.image}" class="post-image" alt="Post">
      <div class="post-info">
        <p>${p.text}</p>
        <div class="post-actions">
          <span class="action-btn like-btn">❤️ ${p.likes}</span>
          <span class="action-btn comment-btn">💬 ${p.comments.length}</span>
        </div>
      </div>
    `;

    postsGrid.appendChild(postCard);
  });

  postsCount.textContent = posts.length;
}

renderPosts();

// Edit bio logic
editBioBtn.addEventListener("click", () => {
  const newBio = prompt("Enter your new bio:", bio.textContent);
  if (newBio && newBio.trim() !== "") {
    bio.textContent = newBio.trim();
    alert("Bio updated successfully!");
  }
});

// Change profile photo
editPhotoBtn.addEventListener("click", () => {
  uploadPhoto.click();
});

uploadPhoto.addEventListener("change", () => {
  const file = uploadPhoto.files[0];
  if (file) {
    const imageUrl = URL.createObjectURL(file);
    profilePhoto.src = imageUrl;
    alert("Profile photo updated!");
  }
});

// Go back to feed
backToFeed.addEventListener("click", () => {
  window.location.href = "feed_page.html";
});
