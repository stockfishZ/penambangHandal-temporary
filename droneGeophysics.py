import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import csv
import time
import math
import re
import threading
from collections import deque

# Install:
# pip install pyserial requests

try:
    import serial
    from serial.tools import list_ports
except Exception:
    serial = None
    list_ports = None

try:
    import requests
except Exception:
    requests = None


# =========================================================
# GANTI URL INI DENGAN URL WEB APP APPS SCRIPT KAMU
# HARUS YANG AKHIRNYA /exec
# =========================================================
APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby65sTz8sPGfIifAejB0KT9uUXsweEILdOtbg54n_IIjRsL2TmEZEpJo3kJxWOHP5vqhQ/exec"


class AdvancedGeomagneticGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Advanced Geomagnetic GIS Monitor - Realtime Spreadsheet")
        self.root.geometry("1400x860")
        self.root.minsize(1200, 720)
        self.root.configure(bg="#e9edf2")

        # ================= SERIAL =================
        self.ser = None
        self.connected = False
        self.last_line = "-"
        self.line_count = 0
        self.last_update = "-"

        # ================= DATA GPS =================
        self.menu = 1
        self.gps_valid = False
        self.sat = 0
        self.lat = 0.0
        self.lng = 0.0
        self.altitude = 0.0
        self.alt_valid = False
        self.speed = 0.0
        self.speed_valid = False

        # ================= DATA MAGNETOMETER =================
        self.mag_type = "NOT FOUND"
        self.mag_x = 0.0
        self.mag_y = 0.0
        self.mag_z = 0.0
        self.mag_total = 0.0
        self.heading = 0.0
        self.direction = "-"

        # ================= LOGGING CSV =================
        self.logging = False
        self.log_file = None
        self.writer = None
        self.log_path = "-"
        self.log_count = 0
        self.last_log_time = 0
        self.last_log_lat = None
        self.last_log_lng = None
        self.log_interval = 1.0

        # ================= GOOGLE SHEETS =================
        self.sheet_upload = False
        self.sheet_count = 0
        self.last_sheet_time = 0
        self.last_sheet_lat = None
        self.last_sheet_lng = None
        self.sheet_status = "OFF"

        # ================= GRAPH DATA =================
        self.max_points = 160
        self.g_mag = deque([0.0] * self.max_points, maxlen=self.max_points)
        self.g_heading = deque([0.0] * self.max_points, maxlen=self.max_points)
        self.g_speed = deque([0.0] * self.max_points, maxlen=self.max_points)
        self.g_sat = deque([0.0] * self.max_points, maxlen=self.max_points)
        self.g_x = deque([0.0] * self.max_points, maxlen=self.max_points)
        self.g_y = deque([0.0] * self.max_points, maxlen=self.max_points)
        self.g_z = deque([0.0] * self.max_points, maxlen=self.max_points)

        # ================= TRACK + TABLE =================
        self.track = []
        self.table_rows = []
        self.max_table_rows = 80

        self.build_ui()
        self.refresh_ui()

        self.root.after_idle(self.draw_all_graphs)
        self.root.after_idle(self.draw_track)
        self.root.after(30, self.serial_loop)
        self.root.protocol("WM_DELETE_WINDOW", self.close_app)

    # ======================================================
    # UI
    # ======================================================
    def build_ui(self):
        header = tk.Frame(self.root, bg="#17324d", height=30)
        header.pack(fill="x", padx=8, pady=(6, 4))
        header.pack_propagate(False)

        tk.Label(
            header,
            text="ADVANCED GEOMAGNETIC GIS MONITOR",
            bg="#17324d",
            fg="white",
            font=("Arial", 12, "bold")
        ).pack(expand=True)

        self.build_controls()
        self.build_status()

        body = tk.Frame(self.root, bg="#e9edf2")
        body.pack(fill="both", expand=True, padx=8, pady=3)

        left = tk.Frame(body, bg="#e9edf2", width=380)
        left.pack(side="left", fill="y", padx=(0, 8))
        left.pack_propagate(False)

        right = tk.Frame(body, bg="#e9edf2")
        right.pack(side="left", fill="both", expand=True)

        self.build_left(left)
        self.build_right(right)

    def build_controls(self):
        frame = tk.Frame(self.root, bg="white", bd=2, relief="groove")
        frame.pack(fill="x", padx=8, pady=4)

        wrap = tk.Frame(frame, bg="white")
        wrap.pack(fill="x", padx=8, pady=5)

        self.port_var = tk.StringVar(value="COM3")
        self.baud_var = tk.StringVar(value="115200")
        self.interval_var = tk.StringVar(value="1")

        tk.Label(wrap, text="Port:", bg="white", font=("Arial", 10, "bold")).pack(side="left")
        self.port_combo = ttk.Combobox(wrap, textvariable=self.port_var, values=self.get_ports(), width=12)
        self.port_combo.pack(side="left", padx=4)

        self.btn(wrap, "Refresh", "#e0f2fe", self.refresh_ports).pack(side="left", padx=4)

        tk.Label(wrap, text="Baud:", bg="white", font=("Arial", 10, "bold")).pack(side="left", padx=(10, 0))
        ttk.Combobox(wrap, textvariable=self.baud_var, values=["9600", "38400", "57600", "115200"], width=9).pack(side="left", padx=4)

        tk.Label(wrap, text="Interval:", bg="white", font=("Arial", 10, "bold")).pack(side="left", padx=(10, 0))
        ttk.Combobox(wrap, textvariable=self.interval_var, values=["1", "2", "3", "5", "10"], width=5).pack(side="left", padx=4)

        self.btn(wrap, "Connect", "#dcfce7", self.connect).pack(side="left", padx=4)
        self.btn(wrap, "Disconnect", "#fee2e2", self.disconnect).pack(side="left", padx=4)
        self.btn(wrap, "Start CSV", "#bbf7d0", self.start_logging).pack(side="left", padx=4)
        self.btn(wrap, "Stop CSV", "#fecaca", self.stop_logging).pack(side="left", padx=4)

        self.btn(wrap, "Start Sheets", "#bfdbfe", self.start_sheet_upload).pack(side="left", padx=4)
        self.btn(wrap, "Stop Sheets", "#ddd6fe", self.stop_sheet_upload).pack(side="left", padx=4)

        self.btn(wrap, "Save Snapshot", "#dbeafe", self.save_snapshot).pack(side="left", padx=4)
        self.btn(wrap, "Clear", "#fef3c7", self.clear_all).pack(side="left", padx=4)
        self.btn(wrap, "Exit", "#fff1f2", self.close_app).pack(side="right", padx=4)

    def build_status(self):
        frame = tk.Frame(self.root, bg="white", bd=2, relief="groove")
        frame.pack(fill="x", padx=8, pady=4)

        self.status_label = tk.Label(
            frame,
            text="Serial: belum connect. Tutup Serial Monitor Arduino IDE sebelum klik Connect.",
            bg="white",
            fg="#b45309",
            font=("Consolas", 11, "bold"),
            anchor="w"
        )
        self.status_label.pack(fill="x", padx=10, pady=(8, 2))

        self.summary_label = tk.Label(
            frame,
            text="",
            bg="white",
            font=("Consolas", 10),
            anchor="w",
            justify="left"
        )
        self.summary_label.pack(fill="x", padx=10, pady=(2, 8))

    def build_left(self, parent):
        self.dashboard_label = self.label_panel(parent, "DASHBOARD", 130)
        self.gps_label = self.label_panel(parent, "GPS", 145)
        self.mag_label = self.label_panel(parent, "MAGNETOMETER", 155)
        self.interpret_label = self.label_panel(parent, "INTERPRETASI", 315, font=("Consolas", 8))
        self.raw_label = self.label_panel(parent, "RAW SERIAL", 45, font=("Consolas", 8))

    def build_right(self, parent):
        top = tk.Frame(parent, bg="#e9edf2")
        top.pack(fill="both", expand=True, pady=(0, 8))

        map_panel = self.panel(top, "GPS TRACK PREVIEW")
        map_panel.pack(side="left", fill="both", expand=True, padx=(0, 5))
        self.map_canvas = tk.Canvas(map_panel, bg="#dfeff7", highlightthickness=0)
        self.map_canvas.pack(fill="both", expand=True, padx=8, pady=8)
        self.map_canvas.bind("<Configure>", lambda e: self.draw_track())

        table_panel = self.panel(top, "DATA TERAKHIR UNTUK QGIS / SPREADSHEET")
        table_panel.pack(side="left", fill="both", expand=True, padx=(5, 0))

        cols = ("time", "lat", "lng", "sat", "mag", "head", "dir")
        self.tree = ttk.Treeview(table_panel, columns=cols, show="headings", height=8)

        headings = {
            "time": "Time", "lat": "Latitude", "lng": "Longitude",
            "sat": "Sat", "mag": "Mag_Total", "head": "Heading", "dir": "Direction"
        }

        widths = {
            "time": 90, "lat": 110, "lng": 110,
            "sat": 45, "mag": 90, "head": 80, "dir": 105
        }

        for c in cols:
            self.tree.heading(c, text=headings[c])
            self.tree.column(c, width=widths[c], anchor="center")

        self.tree.pack(fill="both", expand=True, padx=8, pady=8)

        graphs = tk.Frame(parent, bg="#e9edf2")
        graphs.pack(fill="both", expand=True)

        self.canvas_mag = self.graph_panel(graphs, "GRAFIK MAG TOTAL")
        self.canvas_heading = self.graph_panel(graphs, "GRAFIK HEADING")
        self.canvas_xyz = self.graph_panel(graphs, "GRAFIK MAG X / Y / Z")
        self.canvas_gps = self.graph_panel(graphs, "GRAFIK SPEED & SATELIT")

        self.canvas_mag.grid(row=0, column=0, sticky="nsew", padx=(0, 5), pady=(0, 5))
        self.canvas_heading.grid(row=0, column=1, sticky="nsew", padx=(5, 0), pady=(0, 5))
        self.canvas_xyz.grid(row=1, column=0, sticky="nsew", padx=(0, 5), pady=(5, 0))
        self.canvas_gps.grid(row=1, column=1, sticky="nsew", padx=(5, 0), pady=(5, 0))

        graphs.rowconfigure(0, weight=1)
        graphs.rowconfigure(1, weight=1)
        graphs.columnconfigure(0, weight=1)
        graphs.columnconfigure(1, weight=1)

    def btn(self, parent, text, color, command):
        return tk.Button(
            parent,
            text=text,
            command=command,
            bg=color,
            activebackground=color,
            relief="groove",
            bd=1,
            padx=8,
            pady=4,
            font=("Arial", 9, "bold"),
            cursor="hand2"
        )

    def panel(self, parent, title):
        return tk.LabelFrame(parent, text=title, bg="white", bd=2, relief="groove", font=("Arial", 10, "bold"))

    def label_panel(self, parent, title, height, font=("Consolas", 9)):
        p = self.panel(parent, title)
        p.pack(fill="x", pady=(0, 5))
        p.pack_propagate(False)
        p.configure(height=height)

        label = tk.Label(p, text="", bg="white", font=font, anchor="nw", justify="left")
        label.pack(fill="both", expand=True, padx=8, pady=5)
        return label

    def graph_panel(self, parent, title):
        p = self.panel(parent, title)
        canvas = tk.Canvas(p, bg="white", highlightthickness=0)
        canvas.pack(fill="both", expand=True, padx=8, pady=8)
        canvas.bind("<Configure>", lambda e: self.draw_all_graphs())
        return p

    # ======================================================
    # SERIAL
    # ======================================================
    def get_ports(self):
        if list_ports is None:
            return ["COM3"]
        ports = [p.device for p in list_ports.comports()]
        return ports if ports else ["COM3"]

    def refresh_ports(self):
        self.port_combo["values"] = self.get_ports()

    def connect(self):
        if serial is None:
            messagebox.showerror("pyserial belum ada", "Install dulu:\n\npip install pyserial")
            return

        self.disconnect(close_status=False)

        try:
            port = self.port_var.get().strip()
            baud = int(self.baud_var.get().strip())

            self.ser = serial.Serial(port, baud, timeout=0.02)
            time.sleep(1.2)
            self.ser.reset_input_buffer()
            self.connected = True

            self.status_label.config(
                text=f"Serial: CONNECTED ke {port} @ {baud}.",
                fg="#15803d"
            )
        except Exception as e:
            self.ser = None
            self.connected = False
            self.status_label.config(text=f"Serial gagal connect: {e}", fg="#b91c1c")

    def disconnect(self, close_status=True):
        try:
            if self.ser is not None and self.ser.is_open:
                self.ser.close()
        except Exception:
            pass

        self.ser = None
        self.connected = False

        if close_status:
            self.status_label.config(text="Serial: disconnected.", fg="#b45309")

    def serial_loop(self):
        if self.connected and self.ser is not None:
            try:
                count = 0
                while self.ser.in_waiting and count < 150:
                    line = self.ser.readline().decode("utf-8", errors="ignore").strip()
                    count += 1

                    if line:
                        self.line_count += 1
                        self.last_line = line
                        self.parse_line(line)

                if count > 0:
                    self.raw_label.config(text=f"Line #{self.line_count}\n{self.last_line[:55]}")
                    self.update_after_data()

            except Exception as e:
                self.status_label.config(text=f"Serial error: {e}", fg="#b91c1c")
                self.disconnect(close_status=False)

        self.root.after(30, self.serial_loop)

    # ======================================================
    # PARSER
    # ======================================================
    def norm_key(self, text):
        text = text.strip().lower().replace("_", " ")
        return re.sub(r"\s+", " ", text)

    def to_float(self, text):
        m = re.search(r"[-+]?\d+(?:\.\d+)?", text)
        if not m:
            raise ValueError("No number")
        return float(m.group(0))

    def parse_line(self, line):
        if not line or "=====" in line:
            return
        if ":" not in line:
            return

        key, value = line.split(":", 1)
        key = self.norm_key(key)
        value = value.strip()

        try:
            if key == "menu":
                self.menu = int(round(self.to_float(value)))

            elif key == "gps valid":
                self.gps_valid = value.lower() in ["true", "valid", "ok", "1"]

            elif key in ["gps sat", "satellites", "satelit"]:
                self.sat = int(round(self.to_float(value)))
                self.g_sat.append(float(self.sat))

            elif key in ["lat", "latitude", "gps latitude"]:
                if "belum" in value.lower():
                    self.gps_valid = False
                else:
                    self.lat = self.to_float(value)
                    self.gps_valid = True

            elif key in ["lng", "lon", "longitude", "gps longitude"]:
                if "belum" in value.lower():
                    self.gps_valid = False
                else:
                    self.lng = self.to_float(value)
                    self.gps_valid = True
                    self.add_track_point()

            elif key in ["altitude", "alt"]:
                if "belum" in value.lower() or value == "-":
                    self.alt_valid = False
                else:
                    self.altitude = self.to_float(value)
                    self.alt_valid = True

            elif key in ["speed", "spd"]:
                if "belum" in value.lower() or value == "-":
                    self.speed_valid = False
                else:
                    self.speed = self.to_float(value)
                    self.speed_valid = True
                    self.g_speed.append(float(self.speed))

            elif key == "magnetometer":
                self.mag_type = value

            elif key in ["mag x", "magx"]:
                self.mag_x = self.to_float(value)
                self.g_x.append(float(self.mag_x))

            elif key in ["mag y", "magy"]:
                self.mag_y = self.to_float(value)
                self.g_y.append(float(self.mag_y))

            elif key in ["mag z", "magz"]:
                self.mag_z = self.to_float(value)
                self.g_z.append(float(self.mag_z))

            elif key in ["mag total", "b total"]:
                self.mag_total = self.to_float(value)
                self.g_mag.append(float(self.mag_total))

            elif key in ["heading", "heading deg"]:
                self.heading = self.to_float(value)
                self.g_heading.append(float(self.heading))

            elif key in ["direction", "arah"]:
                self.direction = value

            self.last_update = time.strftime("%H:%M:%S")

        except Exception:
            pass

    def update_after_data(self):
        self.refresh_ui()
        self.update_table()
        self.auto_log()
        self.auto_send_to_sheet()
        self.draw_track()
        self.draw_all_graphs()

    # ======================================================
    # INTERPRETATION
    # ======================================================
    def mag_category(self):
        if self.mag_total < 300:
            return "RENDAH"
        if self.mag_total <= 600:
            return "NORMAL"
        return "TINGGI"

    def ai_interpretation(self):
        if not self.gps_valid:
            return "GPS belum valid. Data belum layak dianalisis. Tunggu koordinat fix."

        if self.mag_type == "NOT FOUND":
            return "Magnetometer belum terbaca. Cek VCC, GND, SDA, SCL, dan alamat I2C."

        recent = [v for v in list(self.g_mag)[-30:] if v != 0.0]

        if len(recent) < 8:
            if self.sat < 4:
                return "Data masih sedikit dan GPS lemah. Lanjutkan survei di area terbuka."
            if self.mag_total > 600:
                return "Data awal tinggi. Jangan langsung simpulkan anomali; cek jarak dari besi/kabel/HP."
            return "Data awal masih terbatas. Lanjutkan lintasan agar pola anomali lebih terbaca."

        avg = sum(recent) / len(recent)
        mn = min(recent)
        mx = max(recent)
        rng = mx - mn
        diff = self.mag_total - avg

        last5 = recent[-5:]
        trend = last5[-1] - last5[0] if len(last5) >= 2 else 0

        if self.sat < 4:
            gps_note = "GPS lemah; posisi titik kurang dipercaya."
        elif self.sat < 8:
            gps_note = "GPS cukup; interpretasi masih perlu validasi."
        else:
            gps_note = "GPS baik; posisi relatif layak dipakai."

        if self.mag_total > 650 or diff > 80:
            status = "ANOMALI TINGGI"
            sebab = "indikasi objek logam, kabel, pagar, kendaraan, atau batuan bermagnet."
            saran = "Ulangi titik ini 2-3 kali dan jauhkan sensor dari benda logam."
        elif self.mag_total < 250 or diff < -80:
            status = "ANOMALI RENDAH"
            sebab = "indikasi perubahan material bawah permukaan atau efek orientasi sensor."
            saran = "Cek ulang heading sensor dan bandingkan dengan titik sekitar."
        elif rng > 120:
            status = "ZONA TIDAK STABIL"
            sebab = "nilai magnetik berubah besar sepanjang lintasan."
            saran = "Perlu peta kontur/interpolasi di QGIS sebelum disimpulkan."
        elif abs(diff) <= 40 and rng <= 80:
            status = "STABIL"
            sebab = "variasi magnetik kecil terhadap titik sekitar."
            saran = "Belum ada indikasi anomali kuat pada titik ini."
        else:
            status = "TRANSISI"
            sebab = "nilai mulai berubah dari pola sekitar."
            saran = "Lanjutkan lintasan rapat untuk melihat batas anomalinya."

        if trend > 50:
            arah_pola = "Tren naik cepat."
        elif trend < -50:
            arah_pola = "Tren turun cepat."
        else:
            arah_pola = "Tren perubahan pelan."

        return (
            f"Status anomali : {status}\n"
            f"Makna data     : {sebab}\n"
            f"Pola lintasan  : {arah_pola} Nilai sekarang {self.mag_total:.1f}, "
            f"rata-rata {avg:.1f}, selisih {diff:+.1f}, rentang {rng:.1f}.\n"
            f"Kualitas GPS   : {gps_note}\n"
            f"Kesimpulan     : {saran}"
        )

    def ready_to_log(self):
        return self.gps_valid and self.lat != 0.0 and self.lng != 0.0 and self.mag_type != "NOT FOUND"

    # ======================================================
    # UI REFRESH
    # ======================================================
    def refresh_ui(self):
        gps_text = "VALID" if self.gps_valid else "NO FIX"
        log_text = "ON" if self.logging else "OFF"
        sheet_text = "ON" if self.sheet_upload else "OFF"

        self.summary_label.config(
            text=(
                f"Update: {self.last_update} | Line: {self.line_count} | "
                f"CSV: {log_text} ({self.log_count}) | "
                f"Sheets: {sheet_text} ({self.sheet_count}) | "
                f"Sheet Status: {self.sheet_status} | File: {self.log_path}"
            )
        )

        self.dashboard_label.config(
            text=(
                f"GPS       : {gps_text}\n"
                f"SATELIT   : {self.sat}\n"
                f"MAG TYPE  : {self.mag_type}\n"
                f"MAG TOTAL : {self.mag_total:.2f}\n"
                f"HEADING   : {self.heading:.2f} deg\n"
                f"ARAH      : {self.direction}"
            )
        )

        lat_text = f"{self.lat:.7f}" if self.gps_valid else "Belum valid"
        lng_text = f"{self.lng:.7f}" if self.gps_valid else "Belum valid"
        alt_text = f"{self.altitude:.2f} m" if self.alt_valid else "Belum valid"
        spd_text = f"{self.speed:.2f} km/h" if self.speed_valid else "Belum valid"

        self.gps_label.config(
            text=(
                f"Status    : {gps_text}\n"
                f"Latitude  : {lat_text}\n"
                f"Longitude : {lng_text}\n"
                f"Satelit   : {self.sat}\n"
                f"Altitude  : {alt_text}\n"
                f"Speed     : {spd_text}"
            )
        )

        self.mag_label.config(
            text=(
                f"Tipe      : {self.mag_type}\n"
                f"Mag X     : {self.mag_x:.2f}\n"
                f"Mag Y     : {self.mag_y:.2f}\n"
                f"Mag Z     : {self.mag_z:.2f}\n"
                f"Mag Total : {self.mag_total:.2f}\n"
                f"Heading   : {self.heading:.2f} deg\n"
                f"Direction : {self.direction}"
            )
        )

        self.interpret_label.config(
            text=(
                f"HASIL INTERPRETASI\n"
                f"Kategori : {self.mag_category()}\n\n"
                f"{self.ai_interpretation()}"
            ),
            fg="#15803d" if self.ready_to_log() else "#b91c1c",
            wraplength=360,
            justify="left",
            anchor="nw"
        )

    # ======================================================
    # TABLE
    # ======================================================
    def update_table(self):
        if not self.gps_valid:
            return

        row = (
            time.strftime("%H:%M:%S"),
            f"{self.lat:.7f}",
            f"{self.lng:.7f}",
            str(self.sat),
            f"{self.mag_total:.2f}",
            f"{self.heading:.2f}",
            self.direction
        )

        if self.table_rows and self.table_rows[-1] == row:
            return

        self.table_rows.append(row)
        if len(self.table_rows) > self.max_table_rows:
            self.table_rows.pop(0)

        self.tree.delete(*self.tree.get_children())
        for r in reversed(self.table_rows):
            self.tree.insert("", "end", values=r)

    # ======================================================
    # GOOGLE SHEETS REALTIME
    # ======================================================
    def start_sheet_upload(self):
        if requests is None:
            messagebox.showerror("requests belum ada", "Install dulu:\n\npip install requests")
            return

        if "TEMPEL_URL" in APPS_SCRIPT_URL or not APPS_SCRIPT_URL.startswith("https://script.google.com/macros/s/"):
            messagebox.showerror(
                "URL Apps Script belum benar",
                "Ganti APPS_SCRIPT_URL dengan URL Web App Apps Script yang berakhiran /exec."
            )
            return

        try:
            self.log_interval = float(self.interval_var.get())
        except Exception:
            self.log_interval = 1.0

        self.sheet_upload = True
        self.sheet_status = "ON - menunggu data valid"
        self.status_label.config(
            text=f"Google Sheets Realtime: ON | Kirim otomatis setiap {self.log_interval:g} detik saat GPS valid.",
            fg="#15803d"
        )
        self.refresh_ui()

    def stop_sheet_upload(self):
        self.sheet_upload = False
        self.sheet_status = "OFF"
        self.status_label.config(text="Google Sheets Realtime: OFF.", fg="#b45309")
        self.refresh_ui()

    def make_payload(self):
        return {
            "gps_valid": self.gps_valid,
            "latitude": round(self.lat, 7),
            "longitude": round(self.lng, 7),
            "satellites": self.sat,
            "altitude_m": round(self.altitude, 2) if self.alt_valid else "",
            "speed_kmh": round(self.speed, 2) if self.speed_valid else "",
            "mag_type": self.mag_type,
            "mag_x": round(self.mag_x, 2),
            "mag_y": round(self.mag_y, 2),
            "mag_z": round(self.mag_z, 2),
            "mag_total": round(self.mag_total, 2),
            "heading_deg": round(self.heading, 2),
            "direction": self.direction,
            "mag_category": self.mag_category(),
            "ai_interpretation": self.ai_interpretation()
        }

    def auto_send_to_sheet(self):
        if not self.sheet_upload:
            return

        if not self.ready_to_log():
            self.sheet_status = "Menunggu GPS & magnetometer valid"
            self.refresh_ui()
            return

        now = time.time()
        if now - self.last_sheet_time < getattr(self, "log_interval", 1.0):
            return

        payload = self.make_payload()
        self.last_sheet_time = now

        threading.Thread(
            target=self.send_sheet_thread,
            args=(payload,),
            daemon=True
        ).start()

    def send_sheet_thread(self, payload):
        try:
            r = requests.post(
                APPS_SCRIPT_URL,
                json=payload,
                timeout=10,
                allow_redirects=True
            )

            response_text = r.text.strip()

            if r.status_code == 200 and response_text == "OK":
                self.sheet_count += 1
                self.sheet_status = "OK"
            else:
                self.sheet_status = f"ERROR: {response_text[:120]}"

        except Exception as e:
            self.sheet_status = f"ERROR: {str(e)[:120]}"

        self.root.after(0, self.refresh_ui)

    # ======================================================
    # CSV LOGGING
    # ======================================================
    def start_logging(self):
        try:
            interval = float(self.interval_var.get())
        except Exception:
            interval = 1.0

        path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv")],
            initialfile="survey_geomagnetik_qgis.csv"
        )

        if not path:
            return

        self.stop_logging(show_message=False)

        try:
            self.log_file = open(path, "w", newline="", encoding="utf-8")
            self.writer = csv.writer(self.log_file)

            self.writer.writerow([
                "Time",
                "GPS_Valid",
                "Latitude",
                "Longitude",
                "Satellites",
                "Altitude_m",
                "Speed_kmh",
                "Mag_Type",
                "Mag_X",
                "Mag_Y",
                "Mag_Z",
                "Mag_Total",
                "Heading_deg",
                "Direction",
                "Mag_Category",
                "AI_Interpretation"
            ])

            self.logging = True
            self.log_path = path
            self.log_count = 0
            self.last_log_time = 0
            self.last_log_lat = None
            self.last_log_lng = None
            self.log_interval = interval

            self.status_label.config(
                text=f"Auto CSV Logging: ON | Simpan otomatis setiap {interval:g} detik saat GPS valid.",
                fg="#15803d"
            )

        except Exception as e:
            self.logging = False
            self.log_file = None
            self.writer = None
            messagebox.showerror("Gagal Logging", str(e))

        self.refresh_ui()

    def stop_logging(self, show_message=True):
        was_logging = self.logging
        self.logging = False

        try:
            if self.log_file:
                self.log_file.flush()
                self.log_file.close()
        except Exception:
            pass

        self.log_file = None
        self.writer = None

        if show_message and was_logging:
            messagebox.showinfo(
                "Logging selesai",
                f"Total titik tersimpan: {self.log_count}\n\nFile:\n{self.log_path}"
            )
            self.status_label.config(
                text=f"Auto CSV Logging: OFF | Total titik tersimpan: {self.log_count}",
                fg="#b45309"
            )

        self.refresh_ui()

    def auto_log(self):
        if not self.logging:
            return
        if self.writer is None or self.log_file is None:
            return
        if not self.ready_to_log():
            return

        now = time.time()
        if now - self.last_log_time < getattr(self, "log_interval", 1.0):
            return

        if self.last_log_lat == self.lat and self.last_log_lng == self.lng:
            return

        self.writer.writerow([
            time.strftime("%Y-%m-%d %H:%M:%S"),
            self.gps_valid,
            round(self.lat, 7),
            round(self.lng, 7),
            self.sat,
            round(self.altitude, 2) if self.alt_valid else "",
            round(self.speed, 2) if self.speed_valid else "",
            self.mag_type,
            round(self.mag_x, 2),
            round(self.mag_y, 2),
            round(self.mag_z, 2),
            round(self.mag_total, 2),
            round(self.heading, 2),
            self.direction,
            self.mag_category(),
            self.ai_interpretation()
        ])

        self.log_file.flush()
        self.log_count += 1
        self.last_log_time = now
        self.last_log_lat = self.lat
        self.last_log_lng = self.lng
        self.refresh_ui()

    def save_snapshot(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv")],
            initialfile="snapshot_geomagnetik.csv"
        )

        if not path:
            return

        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "Time", "GPS_Valid", "Latitude", "Longitude", "Satellites",
                "Altitude_m", "Speed_kmh", "Mag_Type", "Mag_X", "Mag_Y", "Mag_Z",
                "Mag_Total", "Heading_deg", "Direction", "Mag_Category", "AI_Interpretation"
            ])
            writer.writerow([
                time.strftime("%Y-%m-%d %H:%M:%S"),
                self.gps_valid,
                round(self.lat, 7) if self.gps_valid else "",
                round(self.lng, 7) if self.gps_valid else "",
                self.sat,
                round(self.altitude, 2) if self.alt_valid else "",
                round(self.speed, 2) if self.speed_valid else "",
                self.mag_type,
                round(self.mag_x, 2),
                round(self.mag_y, 2),
                round(self.mag_z, 2),
                round(self.mag_total, 2),
                round(self.heading, 2),
                self.direction,
                self.mag_category(),
                self.ai_interpretation()
            ])

        messagebox.showinfo("Snapshot", f"Snapshot berhasil disimpan:\n{path}")

    # ======================================================
    # TRACK
    # ======================================================
    def add_track_point(self):
        if not self.gps_valid:
            return
        if self.lat == 0.0 and self.lng == 0.0:
            return

        p = (self.lat, self.lng)

        if not self.track or self.track[-1] != p:
            self.track.append(p)

        if len(self.track) > 200:
            self.track.pop(0)

    def draw_track(self):
        c = self.map_canvas
        c.delete("all")

        w = max(c.winfo_width(), 400)
        h = max(c.winfo_height(), 220)

        for x in range(0, w, 35):
            c.create_line(x, 0, x, h, fill="#c8d9e6")
        for y in range(0, h, 35):
            c.create_line(0, y, w, y, fill="#c8d9e6")

        c.create_text(12, 10, anchor="nw", text="GPS Track Preview", fill="#17324d", font=("Arial", 10, "bold"))

        if len(self.track) < 2:
            c.create_text(w / 2, h / 2, text="Track muncul setelah GPS valid dan posisi berubah", fill="#555")
            return

        lats = [p[0] for p in self.track]
        lngs = [p[1] for p in self.track]

        min_lat, max_lat = min(lats), max(lats)
        min_lng, max_lng = min(lngs), max(lngs)

        if min_lat == max_lat:
            min_lat -= 0.00001
            max_lat += 0.00001
        if min_lng == max_lng:
            min_lng -= 0.00001
            max_lng += 0.00001

        margin = 35
        pts = []

        for lat, lng in self.track:
            x = margin + (lng - min_lng) / (max_lng - min_lng) * (w - 2 * margin)
            y = h - margin - (lat - min_lat) / (max_lat - min_lat) * (h - 2 * margin)
            pts.append((x, y))

        for i in range(len(pts) - 1):
            c.create_line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], fill="#cc6600", width=3)

        for i, (x, y) in enumerate(pts):
            r = 6 if i == len(pts) - 1 else 4
            fill = "#d32f2f" if i == len(pts) - 1 else "#1565c0"
            c.create_oval(x - r, y - r, x + r, y + r, fill=fill, outline="")

    # ======================================================
    # GRAPH
    # ======================================================
    def draw_all_graphs(self):
        self.draw_graph(self.canvas_mag.winfo_children()[0], [list(self.g_mag)], ["Mag_Total"], "Mag Total")
        self.draw_graph(self.canvas_heading.winfo_children()[0], [list(self.g_heading)], ["Heading"], "Degree", fixed=(0, 360))
        self.draw_graph(self.canvas_xyz.winfo_children()[0], [list(self.g_x), list(self.g_y), list(self.g_z)], ["X", "Y", "Z"], "Mag XYZ")
        self.draw_graph(self.canvas_gps.winfo_children()[0], [list(self.g_speed), list(self.g_sat)], ["Speed", "Sat"], "GPS")

    def draw_graph(self, c, series_list, legends, title, fixed=None):
        c.delete("all")

        w = max(c.winfo_width(), 400)
        h = max(c.winfo_height(), 220)

        left, right, top, bottom = 60, 20, 30, 38

        all_values = []
        for s in series_list:
            all_values.extend(s)

        if fixed:
            y_min, y_max = fixed
        else:
            y_min, y_max = min(all_values), max(all_values)
            if y_min == y_max:
                y_min -= 5
                y_max += 5
            span = y_max - y_min
            y_min -= span * 0.15
            y_max += span * 0.15

        c.create_line(left, top, left, h - bottom, fill="#444", width=2)
        c.create_line(left, h - bottom, w - right, h - bottom, fill="#444", width=2)
        c.create_text(10, 12, anchor="nw", text=title, fill="#111", font=("Arial", 9, "bold"))

        for i in range(5):
            val = y_min + i * (y_max - y_min) / 4
            y = self.y_map(val, h, top, bottom, y_min, y_max)
            c.create_line(left - 5, y, w - right, y, fill="#e5e5e5")
            c.create_text(left - 10, y, text=f"{val:.0f}", anchor="e", fill="#333", font=("Arial", 8))

        colors = ["#1976d2", "#d32f2f", "#388e3c", "#f57c00"]

        for idx, s in enumerate(series_list):
            if len(s) < 2:
                continue

            step = (w - left - right) / (len(s) - 1)
            coords = []

            for i, val in enumerate(s):
                x = left + i * step
                y = self.y_map(val, h, top, bottom, y_min, y_max)
                coords.extend([x, y])

            c.create_line(*coords, fill=colors[idx % len(colors)], width=3, smooth=True)
            c.create_text(w - 120, 18 + idx * 17, text=legends[idx], fill=colors[idx % len(colors)], font=("Arial", 9, "bold"))

    def y_map(self, value, h, top, bottom, y_min, y_max):
        if y_max == y_min:
            return h - bottom
        plot_top = top
        plot_bottom = h - bottom
        ratio = (value - y_min) / (y_max - y_min)
        y = plot_bottom - ratio * (plot_bottom - plot_top)
        return max(plot_top + 5, min(plot_bottom - 5, y))

    # ======================================================
    # CLEAR / CLOSE
    # ======================================================
    def clear_all(self):
        self.track.clear()
        self.table_rows.clear()
        self.tree.delete(*self.tree.get_children())

        for d in [self.g_mag, self.g_heading, self.g_speed, self.g_sat, self.g_x, self.g_y, self.g_z]:
            d.clear()
            d.extend([0.0] * self.max_points)

        self.draw_track()
        self.draw_all_graphs()

    def close_app(self):
        self.stop_logging(show_message=False)
        self.stop_sheet_upload()
        self.disconnect(close_status=False)
        self.root.destroy()


if __name__ == "__main__":
    root = tk.Tk()

    try:
        style = ttk.Style()
        style.theme_use("clam")
    except Exception:
        pass

    app = AdvancedGeomagneticGUI(root)
    root.mainloop()