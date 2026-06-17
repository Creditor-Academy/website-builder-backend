pipeline {
    agent any

    environment {
        // Variables for the build
        DOCKER_IMAGE = 'buildora-backend'
        DOCKER_TAG = "v${env.BUILD_NUMBER}"
        
        // AWS Backend EC2 Details
        BACKEND_IP = '10.3.11.153' // Provided by AWS Team
        SSH_CREDENTIALS_ID = 'backend-ssh-key' // Jenkins Credentials ID for SSH Key
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install & Test') {
            steps {
                // Run tests before building the image
                sh 'npm ci'
                sh 'npm run test'
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    // Build the docker image locally on the Jenkins node
                    sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} -t ${DOCKER_IMAGE}:latest ."
                }
            }
        }

        stage('Deploy to Backend EC2') {
            steps {
                sshagent([SSH_CREDENTIALS_ID]) {
                    script {
                        // 1. Export the image to a tar archive
                        sh "docker save ${DOCKER_IMAGE}:latest -o buildora-backend.tar"
                        
                        // 2. SCP the docker image, docker-compose, and config scripts to the Backend EC2
                        sh "scp -o StrictHostKeyChecking=no buildora-backend.tar ubuntu@${BACKEND_IP}:/home/ubuntu/"
                        sh "scp -o StrictHostKeyChecking=no docker-compose.yml ubuntu@${BACKEND_IP}:/home/ubuntu/"
                        
                        // 3. Load the image and restart the docker-compose services
                        sh """
                        ssh -o StrictHostKeyChecking=no ubuntu@${BACKEND_IP} '
                            cd /home/ubuntu
                            docker load -i buildora-backend.tar
                            docker compose -f docker-compose.yml up -d
                            
                            # Clean up the tar file to save space
                            rm buildora-backend.tar
                        '
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            // Clean up workspace
            cleanWs()
            sh "docker rmi ${DOCKER_IMAGE}:${DOCKER_TAG} || true"
        }
        success {
            echo "Deployment to Backend EC2 successful!"
        }
        failure {
            echo "Deployment failed! Please check logs."
        }
    }
}
