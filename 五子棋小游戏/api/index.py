from flask import Flask, render_template, send_from_directory
import os

app = Flask(__name__, 
    template_folder=os.path.abspath("api/templates"),
    static_folder=os.path.abspath("api/static"))

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)