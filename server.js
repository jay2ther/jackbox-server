const WebSocket = require('ws');
const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: port });

let rooms = {};

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        let data;
        try { data = JSON.parse(message); } catch (e) { return; }

        // 1. GODOT HOSTS THE ROOM (Updated: Godot tells the server the code!)
        if (data.action === "host_room") {
            const code = data.room_code.toUpperCase(); 
            rooms[code] = { host: ws, clients: [] };
            ws.roomCode = code;
            ws.isHost = true;
            ws.send(JSON.stringify({ action: "room_created", room_code: code }));
            console.log(`Room ${code} established by local Godot engine!`);
        }

        // 2. PHONE JOINS THE ROOM
        if (data.action === "join_room") {
            const code = data.room_code.toUpperCase();
            if (rooms[code]) {
                rooms[code].clients.push(ws);
                ws.roomCode = code;
                ws.isHost = false;
                ws.playerName = data.name; 
                
                ws.send(JSON.stringify({ action: "joined", status: "Success" }));
                rooms[code].host.send(JSON.stringify({ action: "player_joined", name: data.name }));
            }
        }

        // 3. UNIVERSAL ROUTER FOR PHONE INPUTS
        if (data.action === "button_press") {
            const code = ws.roomCode;
            if (code && rooms[code] && rooms[code].host) {
                rooms[code].host.send(JSON.stringify({ action: "player_input", payload: data.payload }));
            }
        }

        // 4. ROUTER FOR HOST DASHBOARD
        if (data.action === "host_command") {
            const code = ws.roomCode;
            if (code && rooms[code] && rooms[code].host) {
                rooms[code].host.send(JSON.stringify({ action: "host_command", payload: data.payload }));
            }
        }

        // 5. UNIVERSAL ROUTER FOR GODOT WHISPERS
        if (data.action === "update_client") {
            const code = ws.roomCode;
            if (code && rooms[code] && ws.isHost) {
                const targetClient = rooms[code].clients.find(c => c.playerName === data.target_name);
                if (targetClient) {
                    targetClient.send(JSON.stringify(data.payload));
                }
            }
        }
    });

    ws.on('close', () => {
        if (ws.isHost && ws.roomCode) {
            delete rooms[ws.roomCode];
        } else if (!ws.isHost && ws.roomCode && rooms[ws.roomCode]) {
            if (rooms[ws.roomCode].host && ws.playerName) {
                rooms[ws.roomCode].host.send(JSON.stringify({ action: "player_left", name: ws.playerName }));
            }
            rooms[ws.roomCode].clients = rooms[ws.roomCode].clients.filter(client => client !== ws);
        }
    });
});

console.log("Jackbox Server running on port " + port);
