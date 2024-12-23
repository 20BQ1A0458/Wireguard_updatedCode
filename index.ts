// import express, { Request, Response } from "express";
// import { exec } from "child_process";
// import { promises as fs } from "fs";
// import { IPPoolManager, createIPPoolManager } from "./ipPoolManager";

// const app = express();
// app.use(express.json());

// // WireGuard Configuration Paths
// const PRIVATE_KEY_PATH = "/etc/wireguard/privatekey";
// const PUBLIC_KEY_PATH = "/etc/wireguard/publickey";
// const CONFIG_PATH = "/etc/wireguard/wg0.conf";

// // IP Pool Manager Instance
// const poolManager = createIPPoolManager("10.8.0.0/24");

// // Fixed WireGuard port
// const WG_PORT = 51820;  // Fixed WireGuard port for all pods

// // Utility to execute shell commands
// const executeCommand = (command: string): Promise<string> =>
//   new Promise((resolve, reject) => {
//     exec(command, (error, stdout, stderr) => {
//       if (error) {
//         return reject(stderr || error.message);
//       }
//       resolve(stdout.trim());
//     });
//   });

// // Get Pod Name by Index
// const getPodNameByIndex = async (index: number): Promise<string> => {
//   const output = await executeCommand(
//     "kubectl get pods -n auth -o jsonpath='{.items[*].metadata.name}'"
//   );

//   const podNames = output.split(" ").filter((name) => name.startsWith("node-wireguard"));

//   if (index < 0 || index >= podNames.length) {
//     throw new Error("Index out of range for WireGuard pods");
//   }

//   return podNames[index];
// };

// // Add Peer to Kubernetes Pod
// const addPeerWithKubernetes = async (
//   clientPublicKey: string,
//   assignedIP: string,
//   podName: string
// ): Promise<void> => {
//   try {
//     const command1 = `kubectl exec -n auth ${podName} -- wg set wg0 peer ${clientPublicKey} allowed-ips ${assignedIP}/32`;
//     await executeCommand(command1);

//     const command2 = `kubectl exec -n auth ${podName} -- wg-quick save wg0`;
//     await executeCommand(command2);
//   } catch (error) {
//     console.error("Error in addPeerWithKubernetes:", error instanceof Error ? error.message : error);
//     throw error;
//   }
// };

// // Add Peer to Local WireGuard Instance
// const addPeer = async (clientPublicKey: string, assignedIP: string): Promise<void> => {
//   try {
//     const command = `wg set wg0 peer ${clientPublicKey} allowed-ips ${assignedIP}/32`;
//     await executeCommand(command);
//   } catch (error) {
//     console.error("Error in addPeer:", error instanceof Error ? error.message : error);
//     throw error;
//   }
// };

// // Endpoint for adding a new peer
// app.post("/add-peer", async (req: Request, res: Response): Promise<any> => {
//   const { clientPublicKey } = req.body;

//   if (!clientPublicKey) {
//     return res.status(400).json({ error: "clientPublicKey is required" });
//   }

//   try {
//     const assignedIP = poolManager.assignIP(clientPublicKey);

//     if (assignedIP === null) {
//       return res.status(500).json({ error: "No available IPs" });
//     }

//     const podIndex = 0; // Only using pod 0, remove random index generation
//     const podName = await getPodNameByIndex(podIndex);

//     // Add peer to the Kubernetes pod
//     await addPeerWithKubernetes(clientPublicKey, assignedIP, podName);

//     const serverPublicKey = await executeCommand( `kubectl exec -n auth ${podName} -- cat /etc/wireguard/publickey`);
//     res.status(200).json({
//       message: "Peer added successfully",
//       assignedIP,
//       podName,
//       serverPublicKey: serverPublicKey.trim(),
//     });
//   } catch (error) {
//     res.status(500).json({ error: error instanceof Error ? error.message : "An error occurred" });
//     console.error("Add Peer Error:", error);
//   }
// });

// // Start the Express server
// app.listen(4000, () => {
//   console.log("Server is running on http://0.0.0.0:4000");
// });






















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

