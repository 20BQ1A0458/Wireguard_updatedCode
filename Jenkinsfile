pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'node-wireguard' // Name of the Docker image
        DOCKER_USERNAME = 'bhargavram458' // Docker Hub username
        VERSION_PREFIX = '0.0.' // Version prefix for tagging
        TIMESTAMP = new Date().format("yyyyMMdd'T'HHmmss") // Date-Time format: YYYYMMDD'T'HHMMSS
        DOCKER_TAG = "${VERSION_PREFIX}${BUILD_NUMBER}-${TIMESTAMP}" // Final tag format
        STABLE_TAG = 'stable' // Tag for the stable version
        K8S_NAMESPACE = 'auth' // Namespace for Kubernetes
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

        stage('Build Docker Image') {
            steps {
                script {
                    echo "Building Docker image for branch: ${env.BRANCH_NAME}..."
                    sh """
                        docker build -t ${DOCKER_USERNAME.toLowerCase()}/${DOCKER_IMAGE.toLowerCase()}:${DOCKER_TAG} .
                    """
                }
            }
        }

        stage('Push Docker Image') {
            when {
                anyOf {
                    branch 'master'
                    expression { env.BRANCH_NAME.startsWith('release/') }
                    branch 'staging'
                    branch 'production'
                }
            }
            steps {
                script {
                    echo 'Pushing Docker image to Docker Hub...'
                    withCredentials([usernamePassword(credentialsId: 'docker-credentials-id', usernameVariable: 'DOCKER_USERNAME', passwordVariable: 'DOCKER_PASSWORD')]) {
                        def dockerImageWithRepo = "${DOCKER_USERNAME.toLowerCase()}/${DOCKER_IMAGE.toLowerCase()}:${DOCKER_TAG}"
                        def stableImageWithRepo = "${DOCKER_USERNAME.toLowerCase()}/${DOCKER_IMAGE.toLowerCase()}:${STABLE_TAG}"

                        // Push image with version tag
                        sh """
                            echo $DOCKER_PASSWORD | docker login -u $DOCKER_USERNAME --password-stdin
                            docker push ${dockerImageWithRepo}
                        """

                        // If it's master or release, also tag and push as stable
                        if (env.BRANCH_NAME == 'master' || env.BRANCH_NAME.startsWith('release/')) {
                            echo "Tagging and pushing as stable..."
                            sh """
                                docker tag ${dockerImageWithRepo} ${stableImageWithRepo}
                                docker push ${stableImageWithRepo}
                            """
                        }
                    }
                }
            }
        }

        stage('Deploy to Staging') {
            when {
                branch 'staging'
            }
            steps {
                withKubeCredentials(kubectlCredentials: [
                    [
                        caCertificate: '', 
                        clusterName: 'EKS-1', 
                        contextName: '', 
                        credentialsId: 'k8-token', 
                        namespace: 'auth', 
                        serverUrl: 'https://7302D1DF066773D16142E09F2D140FC0.sk1.ap-south-2.eks.amazonaws.com'
                    ]
                ]) {
                    echo "Deploying version ${DOCKER_TAG} to Staging Kubernetes environment..."
                    sh """
                        kubectl set image deployment.apps/authservice authservice=${DOCKER_USERNAME.toLowerCase()}/${DOCKER_IMAGE.toLowerCase()}:${DOCKER_TAG} -n ${K8S_NAMESPACE}
                        kubectl rollout status deployment.apps/authservice -n ${K8S_NAMESPACE}
                    """
                }
            }
        }

        stage('Deploy to Master') {
            when {
                branch 'master'
            }
            steps {
                withKubeCredentials(kubectlCredentials: [
                    [
                        caCertificate: '', 
                        clusterName: 'EKS-1', 
                        contextName: '', 
                        credentialsId: 'k8-token', 
                        namespace: 'auth', 
                        serverUrl: 'https://7302D1DF066773D16142E09F2D140FC0.sk1.ap-south-2.eks.amazonaws.com'
                    ]
                ]) {
                    echo "Deploying version ${DOCKER_TAG} to Master Kubernetes environment..."
                    sh """
                        kubectl set image deployment.apps/authservice authservice=${DOCKER_USERNAME.toLowerCase()}/${DOCKER_IMAGE.toLowerCase()}:${DOCKER_TAG} -n ${K8S_NAMESPACE}
                        kubectl rollout status deployment.apps/authservice -n ${K8S_NAMESPACE}
                    """
                }
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'production'
            }
            steps {
                withKubeCredentials(kubectlCredentials: [
                    [
                        caCertificate: '', 
                        clusterName: 'EKS-1', 
                        contextName: '', 
                        credentialsId: 'k8-token', 
                        namespace: 'auth', 
                        serverUrl: 'https://7302D1DF066773D16142E09F2D140FC0.sk1.ap-south-2.eks.amazonaws.com'
                    ]
                ]) {
                    echo "Deploying version ${DOCKER_TAG} to Production Kubernetes environment..."
                    sh """
                        kubectl set image deployment.apps/authservice authservice=${DOCKER_USERNAME.toLowerCase()}/${DOCKER_IMAGE.toLowerCase()}:${DOCKER_TAG} -n ${K8S_NAMESPACE}
                        kubectl rollout status deployment.apps/authservice -n ${K8S_NAMESPACE}
                    """
                }
            }
        }

        stage('Verify Deployment') {
            when {
                anyOf {
                    branch 'master'
                    branch 'staging'
                    branch 'production'
                }
            }
            steps {
                withKubeCredentials(kubectlCredentials: [
                    [
                        caCertificate: '', 
                        clusterName: 'EKS-1', 
                        contextName: '', 
                        credentialsId: 'k8-token', 
                        namespace: 'auth', 
                        serverUrl: 'https://7302D1DF066773D16142E09F2D140FC0.sk1.ap-south-2.eks.amazonaws.com'
                    ]
                ]) {
                    echo 'Verifying deployment...'
                    sh "kubectl get all -n ${K8S_NAMESPACE}"
                }
            }
        }

   }

    post {
        always {
            echo 'Pipeline execution completed!'
        }
        success {
            echo "Docker image version ${DOCKER_TAG} built and processed successfully!"
        }
        failure {
            echo "An error occurred during the pipeline execution."
        }
    }
}
