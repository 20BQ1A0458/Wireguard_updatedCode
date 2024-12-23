pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'node-wireguard'
        DOCKER_TAG = 'latest'
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
                    withCredentials([usernamePassword(credentialsId: 'docker-creds', usernameVariable: 'DOCKER_USERNAME', passwordVariable: 'DOCKER_PASSWORD')]) {
                        def dockerImageWithRepo = "${DOCKER_USERNAME.toLowerCase()}/${env.DOCKER_IMAGE.toLowerCase()}:${env.DOCKER_TAG.toLowerCase()}"
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
                        namespace: 'auth', 
                        serverUrl: 'https://7302D1DF066773D16142E09F2D140FC0.sk1.ap-south-2.eks.amazonaws.com'
                    ]
                ]) {
                    echo 'Deploying application to Kubernetes...'
                    sh "kubectl apply -f deployment-service.yaml"
                    sh "kubectl rollout restart deployment/node-wireguard -n auth"
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
                        namespace: 'auth', 
                        serverUrl: 'https://7302D1DF066773D16142E09F2D140FC0.sk1.ap-south-2.eks.amazonaws.com'
                    ]
                ]) {
                    echo 'Verifying deployment...'
                    sh "kubectl get all -n auth"
                }
            }
        }
    }

    post {
        always {
            echo 'Pipeline execution completed!'
        }
        success {
            echo 'Docker image built and pushed successfully to Docker Hub!'
        }
        failure {
            echo 'An error occurred during the pipeline execution.'
        }
    }
}

