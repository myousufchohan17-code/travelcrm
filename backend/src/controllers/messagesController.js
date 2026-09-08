const { query } = require("../config/db");
const { logActivity } = require("../utils/helpers");

async function conversations(req, res, next) {
  try {
    const q = String(req.query.q || "").trim();
    const params = [];
    let where = "";
    if (q) {
      where = "WHERE c.full_name LIKE ? OR m.body LIKE ?";
      params.push(`%${q}%`, `%${q}%`);
    }
    const rows = await query(
      `SELECT
         conv.id, conv.client_id, conv.channel, conv.last_message_at, conv.created_at,
         c.full_name AS client_name, c.phone AS client_phone, c.email AS client_email,
         (
           SELECT body FROM messages WHERE conversation_id = conv.id ORDER BY created_at DESC LIMIT 1
         ) AS last_message,
         (
           SELECT COUNT(*) FROM messages WHERE conversation_id = conv.id AND is_read = 0 AND sender_type = 'client'
         ) AS unread_count
       FROM conversations conv
       LEFT JOIN clients c ON c.id = conv.client_id
       LEFT JOIN messages m ON m.id = (
         SELECT id FROM messages WHERE conversation_id = conv.id ORDER BY created_at DESC LIMIT 1
       )
       ${where}
       ORDER BY COALESCE(conv.last_message_at, conv.created_at) DESC`,
      params
    );
    res.json(rows.map((r) => ({ ...r, unread_count: Number(r.unread_count) })));
  } catch (err) {
    next(err);
  }
}

async function unreadCount(_req, res, next) {
  try {
    const rows = await query(
      `SELECT COUNT(*) AS count FROM messages WHERE is_read = 0 AND sender_type = 'client'`
    );
    res.json({ count: Number(rows[0].count) });
  } catch (err) {
    next(err);
  }
}

async function thread(req, res, next) {
  try {
    const conv = await query(
      `SELECT conv.*, c.full_name AS client_name, c.phone AS client_phone, c.email AS client_email
       FROM conversations conv
       LEFT JOIN clients c ON c.id = conv.client_id
       WHERE conv.id = ?`,
      [req.params.id]
    );
    if (!conv.length) return res.status(404).json({ message: "Conversation not found" });
    const messages = await query(
      `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
      [req.params.id]
    );
    await query(
      `UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_type = 'client'`,
      [req.params.id]
    );
    res.json({ conversation: conv[0], messages });
  } catch (err) {
    next(err);
  }
}

async function send(req, res, next) {
  try {
    const { client_id, conversation_id, body, channel } = req.body;
    if (!body || !String(body).trim()) {
      return res.status(400).json({ message: "Message body is required" });
    }
    let convId = conversation_id;
    if (!convId) {
      if (!client_id) return res.status(400).json({ message: "Client is required" });
      const existing = await query("SELECT id FROM conversations WHERE client_id = ? LIMIT 1", [
        client_id,
      ]);
      if (existing.length) {
        convId = existing[0].id;
      } else {
        const created = await query(
          `INSERT INTO conversations (client_id, channel, last_message_at) VALUES (?, ?, NOW())`,
          [client_id, channel || "internal"]
        );
        convId = created.insertId;
      }
    }
    const msg = await query(
      `INSERT INTO messages (conversation_id, sender_type, sender_id, body, is_read)
       VALUES (?, 'user', ?, ?, 1)`,
      [convId, req.user.id, body.trim()]
    );
    await query("UPDATE conversations SET last_message_at = NOW() WHERE id = ?", [convId]);
    await logActivity(req.user.id, "created", "message", msg.insertId, "Message sent");
    const rows = await query("SELECT * FROM messages WHERE id = ?", [msg.insertId]);
    res.status(201).json({ conversation_id: convId, message: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { conversations, unreadCount, thread, send };
