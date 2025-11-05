from flask import Flask
app = Flask(__name__)

@app.route("/")
def home():
    return "Working as intended"

@app.route("/test")
def test():
    return "Testing... <br> good <br> okay"
if __name__=="__main__":
    app.run(debug=True)