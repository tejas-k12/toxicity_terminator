document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (username === "" || password === "") {
    showError("Please fill in all fields.");
    return;
  }

  if (password.length < 6) {
    showError("Password must be at least 6 characters long.");
    return;
  }

  // Simulated authentication
  if (username === "admin" && password === "admin123") {
    showSuccess("Login successful! Redirecting...");
    setTimeout(() => {
      window.location.href = "feed_page.html";
    }, 1500);
  } else {
    showError("Invalid username or password.");
  }
});

function showError(message) {
  const errorBox = document.createElement("div");
  errorBox.classList.add("alert", "error");
  errorBox.innerText = message;
  document.body.appendChild(errorBox);
  setTimeout(() => errorBox.remove(), 2500);
}

function showSuccess(message) {
  const successBox = document.createElement("div");
  successBox.classList.add("alert", "success");
  successBox.innerText = message;
  document.body.appendChild(successBox);
  setTimeout(() => successBox.remove(), 2500);
}

// Styling for alert dynamically
const style = document.createElement("style");
style.innerHTML = `
.alert {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255,255,255,0.15);
  backdrop-filter: blur(10px);
  color: #fff;
  padding: 12px 25px;
  border-radius: 10px;
  font-weight: 500;
  box-shadow: 0 0 10px rgba(0,0,0,0.4);
  animation: fadeInOut 2.5s ease forwards;
}
.alert.error { border-left: 4px solid #ff5b5b; }
.alert.success { border-left: 4px solid #00c853; }

@keyframes fadeInOut {
  0% { opacity: 0; transform: translate(-50%, -20px); }
  10%, 90% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, -20px); }
}
`;
document.head.appendChild(style);
