pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'node-wireguard'
        DOCKER_TAG = 'latest'
        NAMESPACE = 'auth'
        DEPLOYMENT_NAME = 'node-wireguard'
        DOCKER_REPO = '' // Optional: Add Docker repository name if not the same as the username
    }

    stages {
        stage('Checkout Code') {
            steps {
                script {
                    echo "Checking out code from branch: ${env.BRANCH_NAME}"
                    checkout scm
                }
            }
        }

        stage('Build and Push Docker Image') {
            steps {
                script {
                    echo 'Building and pushing Docker image to Docker Hub...'
                    withCredentials([usernamePassword(credentialsId: 'docker-credentials-id', usernameVariable: 'DOCKER_USERNAME', passwordVariable: 'DOCKER_PASSWORD')]) {
                        def dockerRepo = env.DOCKER_REPO ? "${env.DOCKER_REPO}" : "${DOCKER_USERNAME.toLowerCase()}"
                        def dockerImageWithRepo = "${dockerRepo}/${env.DOCKER_IMAGE.toLowerCase()}:${env.DOCKER_TAG.toLowerCase()}"
                        sh """
                            echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin
                            docker build -t ${dockerImageWithRepo} .
                            docker push ${dockerImageWithRepo}
                        """
                    }
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                withKubeCredentials(kubectlCredentials: [
                    [
                        caCertificate: '', 
                        clusterName: 'EKS-1', 
                        contextName: '', 
                        credentialsId: 'k8-token', 
                        namespace: env.NAMESPACE, 
                        serverUrl: 'https://7302D1DF066773D16142E09F2D140FC0.sk1.ap-south-2.eks.amazonaws.com'
                    ]
                ]) {
                    script {
                        echo 'Updating Kubernetes deployment...'
                        sh """
                            kubectl set image deployment/${DEPLOYMENT_NAME} \
                            ${DEPLOYMENT_NAME}=${DOCKER_IMAGE}:${DOCKER_TAG} -n ${NAMESPACE}
                            kubectl rollout restart deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE}
                        """
                    }
                }
            }
        }

        stage('Verify Deployment') {
            steps {
                withKubeCredentials(kubectlCredentials: [
                    [
                        caCertificate: '', 
                        clusterName: 'EKS-1', 
                        contextName: '', 
                        credentialsId: 'k8-token', 
                        namespace: env.NAMESPACE, 
                        serverUrl: 'https://7302D1DF066773D16142E09F2D140FC0.sk1.ap-south-2.eks.amazonaws.com'
                    ]
                ]) {
                    script {
                        echo 'Verifying deployment...'
                        sh """
                            kubectl rollout status deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE}
                            kubectl get pods -o wide -n ${NAMESPACE}
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            echo 'Pipeline execution completed!'
        }
        success {
            echo 'Docker image built, pushed, and Kubernetes deployment updated successfully!'
        }
        failure {
            echo 'An error occurred during the pipeline execution.'
        }
    }
}
