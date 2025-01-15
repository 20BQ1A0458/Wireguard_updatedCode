import express, { Request, Response } from "express";
import { exec } from "child_process";
import { promises as fs } from "fs";
import { IPPoolManager, createIPPoolManager } from "./ipPoolManager";

const app = express();
app.use(express.json());

// WireGuard Configuration Paths
const PRIVATE_KEY_PATH = "/etc/wireguard/privatekey";
const PUBLIC_KEY_PATH = "/etc/wireguard/publickey";
const CONFIG_PATH = "/etc/wireguard/wg0.conf";

// IP Pool Manager Instance
const poolManager = createIPPoolManager("10.8.0.0/24");

// Utility to execute shell commands
const executeCommand = (command: string): Promise<string> =>
  new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        return reject(stderr || error.message);
      }
      resolve(stdout.trim());
    });
  });

// Get Pod Name by Index
const getPodNameByIndex = async (index: number): Promise<string> => {
  const output = await executeCommand(
    "kubectl get pods -n wireguard -o jsonpath='{.items[*].metadata.name}'"
  );

  const podNames = output
    .split(" ")
    .filter((name) => name.startsWith("node-wireguard"));

  if (index < 0 || index >= podNames.length) {
    throw new Error("Index out of range for WireGuard pods");
  }

  return podNames[index];
};

// Add Peer to Kubernetes Pod
const addPeerWithKubernetes = async (
  clientPublicKey: string,
  assignedIP: string
): Promise<void> => {
  try {
    // Add the peer to the WireGuard configuration in the Kubernetes pod
    const command1 = `wg set wg0 peer ${clientPublicKey} allowed-ips ${assignedIP}/32`;
    await executeCommand(command1);

    // Save the WireGuard configuration
    const command2 = `wg-quick save wg0`;
    await executeCommand(command2);
  } catch (error) {
    console.error(
      "Error in addPeerWithKubernetes:",
      error instanceof Error ? error.message : error
    );
    throw error;
  }
};

// Add Peer to Kubernetes Pod
const removePeerWithKubernetes = async (
  clientPublicKey: string,
  podName: string
): Promise<void> => {
  try {
    // Add the peer to the WireGuard configuration in the Kubernetes pod
    const cmdRemovePeer = `kubectl exec ${podName} -- wg set wg0 peer ${clientPublicKey} remove`;
    await executeCommand(cmdRemovePeer);

    // Save the WireGuard configuration
    const cmdSaveWGConfig = `kubectl exec ${podName} -- wg-quick save wg0`;
    await executeCommand(cmdSaveWGConfig);
  } catch (error) {
    console.error(
      "Error in removingPeerWithKubernetes:",
      error instanceof Error ? error.message : error
    );
    throw error;
  }
};

// Add Peer to Local WireGuard Instance
const addPeer = async (
  clientPublicKey: string,
  assignedIP: string
): Promise<void> => {
  try {
    const command = `wg set wg0 peer ${clientPublicKey} allowed-ips ${assignedIP}/32`;
    await executeCommand(command);
  } catch (error) {
    console.error(
      "Error in addPeer:",
      error instanceof Error ? error.message : error
    );
    throw error;
  }
};

// Endpoint for adding a new peer
app.post("/add-peer", async (req: Request, res: Response): Promise<any> => {
  const { clientPublicKey } = req.body;

  // Validate clientPublicKey
  if (!clientPublicKey) {
    return res.status(400).json({ error: "clientPublicKey is required" });
  }

  try {
    // Assign an IP from the pool for the new peer
    const assignedIP = poolManager.assignIP(clientPublicKey);

    if (assignedIP === null) {
      return res.status(500).json({ error: "No available IPs" });
    }

    // Randomly select one of the WireGuard pods (assuming 2 pods)
    const randomIndex = Math.floor(Math.random() * 2); // Random index (0 or 1)
    //const podName = await getPodNameByIndex(randomIndex);

    // Add the peer to the selected Kubernetes pod
    await addPeerWithKubernetes(clientPublicKey, assignedIP);

    // Retrieve the server's public key from the selected pod
    const serverPublicKey = await executeCommand(
      `cat /etc/wireguard/publickey`
    );

    const nodePort = await getNodePort();
    const externalIP = await getExternalIP();
    const podName = await getPodName();
    // Respond with success
    res.status(200).json({
      message: "Peer added successfully",
      assignedIP,
      podName,
      nodePort,
      externalIP,
      serverPublicKey: serverPublicKey.trim(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "An error occurred",
    });
    console.error("Add Peer Error:", error);
  }
});

function getPodName() {
  return executeCommand("echo $POD_NAME");
}

async function getNodePort() {
  const serviceName = await executeCommand(
    "kubectl get svc -n wireguard -o=jsonpath='{.items[?(@.spec.ports[0].protocol==\"UDP\")].metadata.name}'"
  )
  return await executeCommand(
    //here we are hardcoding the service name, you can pass it as an argument
    `kubectl get svc  ${serviceName}  -n wireguard -o=jsonpath='{.spec.ports[0].nodePort}'`
    //`kubectl get svc ${serviceName} -n wireguard -o=jsonpath='{.spec.ports[?(@.protocol=="UDP")].nodePort}'`
  );
}

function getHostName() {
  return executeCommand("hostname");
}

async function getExternalIP() {
  var nodeName = await getHostName();
  console.log(nodeName)
  return executeCommand(
    `kubectl get node ${nodeName} -o jsonpath='{.metadata.annotations.external-ip}'`
  );
}

// Endpoint for adding a new peer
app.post("/add-peer", async (req: Request, res: Response): Promise<any> => {
  const { clientPublicKey, podName } = req.body;

  // Validate clientPublicKey
  if (!clientPublicKey) {
    return res.status(400).json({ error: "clientPublicKey is required" });
  }

  try {
    // Assign an IP from the pool for the new peer
    const assignedIP = poolManager.assignIP(clientPublicKey);

    if (assignedIP === null) {
      return res.status(500).json({ error: "No available IPs" });
    }

    // Randomly select one of the WireGuard pods (assuming 2 pods)
    const randomIndex = Math.floor(Math.random() * 2); // Random index (0 or 1)
    //const podName = await getPodNameByIndex(randomIndex);

    // Add the peer to the selected Kubernetes pod
    await addPeerWithKubernetes(clientPublicKey, assignedIP);

    // Retrieve the server's public key from the selected pod
    const serverPublicKey = await executeCommand(
      `cat /etc/wireguard/publickey`
    );

    const nodePort = await getNodePort();
    const externalIP = await getExternalIP();
    const podName = await getPodName();
    // Respond with success
    res.status(200).json({
      message: "Peer added successfully",
      assignedIP,
      podName,
      nodePort,
      externalIP,
      serverPublicKey: serverPublicKey.trim(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "An error occurred",
    });
    console.error("Add Peer Error:", error);
  }
});

app.post("/remove-peer", async (req: Request, res: Response): Promise<any> => {
  const { clientPublicKey, podName } = req.body;

  // Validate clientPublicKey
  if (!clientPublicKey) {
    return res.status(400).json({ error: "clientPublicKey is required" });
  }

  // Validate podName
  if (!podName) {
    return res.status(400).json({ error: "podName is required" });
  }
  
  try {
    // Add the peer to the selected Kubernetes pod
    await removePeerWithKubernetes(req.body.clientPublicKey, req.body.podName);

    // Respond with success
    res.status(200).json({
      message: "Peer removed successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "An error occurred",
    });
    console.error("Add Peer Error:", error);
  }
});

// Start the Express server
app.listen(4000, () => {
  console.log("Server is running on http://0.0.0.0:4000");
});

// ------------------------------------------------------Socket Code ---------------------------Working Fine--------------------------------------------

// import dgram, { RemoteInfo } from 'dgram';

// // Create the UDP server
// const server = dgram.createSocket('udp4');

// // Handling incoming messages
// server.on('message', (msg: Buffer, rinfo: RemoteInfo) => {
//   console.log(`Received message: ${msg.toString()} from ${rinfo.address}:${rinfo.port}`);
// });

// // Server listening on port 51820 (NodePort)
// server.on('listening', () => {
//   const address = server.address();
//   console.log(`Server listening on ${address.address}:${address.port}`);
// });

// // Handling errors
// server.on('error', (err) => {
//   console.error(`Server error: ${err.stack}`);
//   server.close();
// });

// // Bind the server to the port 51820 (the NodePort)
// const PORT = 51820;
// const HOST = '0.0.0.0'; // Listen on all available interfaces

// server.bind(PORT, HOST, () => {
//   console.log(`Server bound to ${HOST}:${PORT}`);
// });
