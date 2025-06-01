const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory DB
const db = new sqlite3.Database(':memory:');

// Initialize tables and data
db.serialize(() => {
  db.run(`
    CREATE TABLE libraries (
      id TEXT PRIMARY KEY,
      name TEXT,
      location TEXT
    )
  `);

  db.run(`
    CREATE TABLE library_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      library_id TEXT,
      day_of_week TEXT,
      hours TEXT,
      FOREIGN KEY(library_id) REFERENCES libraries(id)
    )
  `);

  const libraries = [
    ["library_national", "National Library", "100 Victoria Street, Singapore 188064"],
    ["library_bishan", "Bishan Public Library", "5 Bishan Place, #01-01, Singapore 579841"],
    ["library_jurong", "Jurong Regional Library", "21 Jurong East Central 1, Singapore 609732"],
    ["library_tampines", "Tampines Regional Library", "1 Tampines Walk, #02-01 Our Tampines Hub, Singapore 528523"]
  ];

  const days = [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Public Holidays"
  ];

  const openHours = {
    "Monday": "Closed",
    "Tuesday": "10:00 AM - 9:00 PM",
    "Wednesday": "10:00 AM - 9:00 PM",
    "Thursday": "10:00 AM - 9:00 PM",
    "Friday": "10:00 AM - 9:00 PM",
    "Saturday": "10:00 AM - 9:00 PM",
    "Sunday": "10:00 AM - 9:00 PM",
    "Public Holidays": "Closed"
  };

  const insertLibrary = db.prepare("INSERT INTO libraries VALUES (?, ?, ?)");
  const insertHour = db.prepare("INSERT INTO library_hours (library_id, day_of_week, hours) VALUES (?, ?, ?)");

  libraries.forEach(([id, name, location]) => {
    insertLibrary.run(id, name, location);
    days.forEach((day) => {
      insertHour.run(id, day, openHours[day]);
    });
  });

  insertLibrary.finalize();
  insertHour.finalize();
});

// 📍 GET: All libraries
app.get('/libraries', (req, res) => {
  db.all("SELECT * FROM libraries", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 📅 GET: Specific library with formatted hours
app.get('/libraries/:id', (req, res) => {
  const id = req.params.id;

  db.get("SELECT * FROM libraries WHERE id = ?", [id], (err, libRow) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!libRow) return res.status(404).json({ error: "Library not found" });

    db.all(
      `SELECT day_of_week, hours FROM library_hours WHERE library_id = ?
       ORDER BY 
         CASE day_of_week
           WHEN 'Monday' THEN 1
           WHEN 'Tuesday' THEN 2
           WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4
           WHEN 'Friday' THEN 5
           WHEN 'Saturday' THEN 6
           WHEN 'Sunday' THEN 7
           WHEN 'Public Holidays' THEN 8
         END`,
      [id],
      (err, hourRows) => {
        if (err) return res.status(500).json({ error: err.message });

        const formattedHours = hourRows
          .map(h => `• ${h.day_of_week}: ${h.hours}`)
          .join('\n');

        const message = `📚 ${libRow.name}\n📍 ${libRow.location}\n\n🕒 Opening Hours:\n${formattedHours}`;

        res.json({
          message,
          details: {
            name: libRow.name,
            location: libRow.location,
            hours: hourRows
          }
        });
      }
    );
  });
});

app.listen(PORT, () => {
  console.log(`✅ Library API running at http://localhost:${PORT}`);
});
