apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: node-wireguard
  namespace: auth
spec:
  serviceName: "node-wireguard"
  replicas: 2
  selector:
    matchLabels:
      app: node-wireguard
  template:
    metadata:
      labels:
        app: node-wireguard
    spec:
      serviceAccountName: jenkins
      hostNetwork: true
      initContainers:
        - name: wireguard-setup
          image: ubuntu:latest
          command:
            - /bin/bash
            - -c
            - |
              apt-get update && apt-get install -y \
                wireguard \
                wireguard-tools \
                iproute2 \
                iptables \
                iputils-ping \
                curl \
                && apt-get clean && rm -rf /var/lib/apt/lists/*

              # Generate WireGuard private and public keys
              PRIVATE_KEY=$(wg genkey)
              PUBLIC_KEY=$(echo $PRIVATE_KEY | wg pubkey)

              # Use the pod's hostname as POD_NAME
              POD_NAME=$(hostname)
              echo "POD_NAME=$POD_NAME"
              
              # Extract pod index directly from pod name (expecting 'node-wireguard-0' or 'node-wireguard-1')
              POD_INDEX=$(echo $POD_NAME | sed -E 's/.*-(.*)/\1/')
              echo "Extracted POD_INDEX=$POD_INDEX"

              # Calculate ListenPort dynamically based on the pod index (51820 for pod 0, 51821 for pod 1)
              LISTEN_PORT=$((51820 + ${POD_INDEX}))
              echo "Calculated LISTEN_PORT=$LISTEN_PORT"

              # Save keys and configuration to /etc/wireguard
              echo $PRIVATE_KEY > /etc/wireguard/privatekey
              echo $PUBLIC_KEY > /etc/wireguard/publickey

              # Write the WireGuard configuration file
              echo "[Interface]" > /etc/wireguard/wg0.conf
              echo "PrivateKey=$(cat /etc/wireguard/privatekey)" >> /etc/wireguard/wg0.conf
              echo "Address=10.8.0.1/24" >> /etc/wireguard/wg0.conf
              
              # Conditionally set ListenPort if it’s missing or empty
              current_listen_port=$(grep 'ListenPort=' /etc/wireguard/wg0.conf)
              if [[ -z "$current_listen_port" ]]; then
                echo "ListenPort=$LISTEN_PORT" >> /etc/wireguard/wg0.conf
                echo "ListenPort was missing. Set to $LISTEN_PORT"
              else
                echo "ListenPort already set to $current_listen_port"
              fi

              cat /etc/wireguard/wg0.conf

              # Bring up the WireGuard interface
              if ! wg show wg0 > /dev/null 2>&1; then
                wg-quick up wg0
              else
                echo "WireGuard interface wg0 is already up."
              fi
          securityContext:
            privileged: true
            capabilities:
              add:
                - NET_ADMIN  
          volumeMounts:
            - name: wireguard-config
              mountPath: /etc/wireguard

      containers:
        - name: node-wireguard
          image: bhargavram458/node-wireguard:latest
          ports:
            - containerPort: 4000   # Node.js app
              protocol: TCP
            - containerPort: 51820  # WireGuard UDP port
              protocol: UDP
            - containerPort: 51821  # WireGuard UDP port
              protocol: UDP
          env:
            - name: NODE_ENV
              value: production
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name  # Expose pod name to the container
          securityContext:
            capabilities:
              add:
                - NET_ADMIN  # Required for WireGuard operation
          volumeMounts:
            - name: wireguard-config
              mountPath: /etc/wireguard  # Mount WireGuard config into the container

      volumes:
        - name: wireguard-config
          emptyDir: {}  # Temporary volume for storing WireGuard config files
