pipeline {
    agent any

    environment {
        LOGIN_IMG     = "login_microservice"
        FEED_IMG      = "feed_microservice"
        PROFILE_IMG   = "profile_microservice"
        MODERATOR_IMG = "moderator_microservice"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Create Dockerfiles') {
            steps {
                script {
                    // LOGIN MICROSERVICE
                    writeFile file: 'Dockerfile.login', text: """
FROM nginx:alpine
COPY login_page.html /usr/share/nginx/html/index.html
COPY login_style.css /usr/share/nginx/html/
COPY login_script.js /usr/share/nginx/html/
EXPOSE 80
"""
                    // FEED MICROSERVICE
                    writeFile file: 'Dockerfile.feed', text: """
FROM nginx:alpine
COPY feed_page.html /usr/share/nginx/html/index.html
COPY feed_style.css /usr/share/nginx/html/
COPY feed_script.js /usr/share/nginx/html/
EXPOSE 80
"""
                    // PROFILE MICROSERVICE
                    writeFile file: 'Dockerfile.profile', text: """
FROM nginx:alpine
COPY profile.html /usr/share/nginx/html/index.html
COPY profile_style.css /usr/share/nginx/html/
COPY profile_script.js /usr/share/nginx/html/
EXPOSE 80
"""
                    // MODERATOR MICROSERVICE (Node.js OCR)
                    writeFile file: 'Dockerfile.moderator', text: """
FROM node:18-alpine
WORKDIR /app
COPY ocr-server.js .
COPY ocr-moderator.js .
RUN npm init -y
RUN npm install tesseract.js
EXPOSE 5000
CMD ["node","ocr-server.js"]
"""
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    sh "docker build -f Dockerfile.login     -t ${LOGIN_IMG}     ."
                    sh "docker build -f Dockerfile.feed      -t ${FEED_IMG}      ."
                    sh "docker build -f Dockerfile.profile   -t ${PROFILE_IMG}   ."
                    sh "docker build -f Dockerfile.moderator -t ${MODERATOR_IMG} ."
                }
            }
        }

        stage('Run Tests') {
            steps {
                script {
                    echo "=== Running tests for microservices ==="
                    // Replace the lines below with actual test commands
                    sh "echo Testing Login Microservice …"
                    sh "echo Testing Feed Microservice …"
                    sh "echo Testing Profile Microservice …"
                    sh "echo Testing Moderator Microservice …"
                }
            }
        }

        stage('Deploy Locally') {
            steps {
                script {
                    // Remove existing containers if any
                    sh """
                    docker rm -f login_ms      2>/dev/null || true
                    docker rm -f feed_ms       2>/dev/null || true
                    docker rm- f profile_ms    2>/dev/null || true
                    docker rm -f moderator_ms  2>/dev/null || true
                    """
                    // Run fresh containers
                    sh "docker run -d --name login_ms      -p 8001:80   ${LOGIN_IMG}"
                    sh "docker run -d --name feed_ms       -p 8002:80   ${FEED_IMG}"
                    sh "docker run -d --name profile_ms    -p 8003:80   ${PROFILE_IMG}"
                    sh "docker run -d --name moderator_ms  -p 5000:5000 ${MODERATOR_IMG}"
                }
            }
        }
    }

    post {
        success {
            echo "✅ All microservices deployed!"
            echo "Login:     http://localhost:8001"
            echo "Feed:      http://localhost:8002"
            echo "Profile:   http://localhost:8003"
            echo "Moderator: http://localhost:5000"
        }
        failure {
            echo "❌ Pipeline failed."
        }
    }
}
