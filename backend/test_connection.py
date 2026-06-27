import socket

def test_ibm_connection():
    hostname = "eu-gb.ml.cloud.ibm.com"
    port = 443
    print(f"Testing connection to {hostname}...")
    try:
        # Try to resolve the address
        ip = socket.gethostbyname(hostname)
        print(f"Success! {hostname} resolved to {ip}")
        return True
    except socket.gaierror:
        print(f"FAILED: Could not find {hostname}. Check your internet or DNS settings.")
        return False

if __name__ == "__main__":
    test_ibm_connection()
