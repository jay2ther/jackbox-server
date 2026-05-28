const WebSocket = require('ws');
const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: port });

let rooms = {};

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        let data;
        try { data = JSON.parse(message); } catch (e) { return; }

        // 1. GODOT HOSTS THE ROOM
        if (data.action === "host_room") {
            const code = generateRoomCode();
            rooms[code] = { host: ws, clients: [] };
            ws.roomCode = code;
            ws.isHost = true;
            ws.send(JSON.stringify({ action: "room_created", room_code: code }));
            console.log(`Room ${code} created!`);
        }

        // 2. PHONE JOINS THE ROOM
        if (data.action === "join_room") {
            const code = data.room_code.toUpperCase();
            if (rooms[code]) {
                rooms[code].clients.push(ws);
                ws.roomCode = code;
                ws.isHost = false;
                ws.playerName = data.name; // Server memorizes the phone's name
                
                ws.send(JSON.stringify({ action: "joined", status: "Success" }));
                rooms[code].host.send(JSON.stringify({ action: "player_joined", name: data.name }));
            }
        }

        // 3. PHONE SENDS A BUTTON PRESS
        if (data.action === "button_press") {
            const code = ws.roomCode;
            if (code && rooms[code] && rooms[code].host) {
                rooms[code].host.send(JSON.stringify({ action: "player_input", payload: data.payload }));
            }
        }

        // 4. GODOT WHISPERS BACK TO A SPECIFIC PHONE
        if (data.action === "update_client") {
            const code = ws.roomCode;
            if (code && rooms[code] && ws.isHost) {
                const targetClient = rooms[code].clients.find(c => c.playerName === data.target_name);
                if (targetClient) {
                    targetClient.send(JSON.stringify({ 
                        action: "profile_loaded", 
                        currency: data.currency 
                    }));
                }
            }
        }
    });

    // 5. SOMEONE DISCONNECTS
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
