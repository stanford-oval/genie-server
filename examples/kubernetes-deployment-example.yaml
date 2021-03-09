# Kubernetes deployment

    This is a very basic configuration file for running almond-server on a Kubernetes cluster.

    After applying this manifest, two containers are created by the pod and provides the following:
        almond-server as the main deployment
        nginx as a reverse proxy sidecar
        sets securityContex for a specific user; in this example 'pi' with UID & GID of 1000.
        configures a NodePort for Home-Assistant and local access

    It is also assumed that PulesAudio runs in user mode
    
## Getting Started

Find your UID and GID from the command line.
Copy file 'kubernetes-deployment-example.yaml' to your prefered location, edit the following settings if necessary.

Default values
---
    deployment
        image: stanfordoval/almond-server   ...    your image here if not amd64
---
    env:
        TZ: Europe/London                   ...    your timezone 
---
    SecurityContes:     this ensures that the container runs as a specific user
        runAsGroup: 1000                    ...    enter your GID and UID here 
        runAsUser: 1000                     ...    find it by typing 'id' from the command line 
---
    volumes:
        hostPath:
            path: /run/user/1000/pulse       ...    this is just $XDG_RUNTIME_DIR/pulse 
            path: /home/pi/.config/almond-server    path to your Almond-Server config directory 
---
    service
        spec:
            nodePort: 32000                   ...   a valid port value of your choice 
---
    configmap
        server
            allow   10.1.12.1;                ...   example only, check nginx logs for connection failures
---

### Run almond-server

    kubectl apply -f kubernetes-deployment-example.yaml

    Navigate to http://<almond host>:32000 for almond web interface
    You should reach Almond's Initial Configuration page where you are invited to set a password.

Home-Assistant config for this example.

```yaml
# Example configuration.yaml entry
almond:
  type: local
  host: http://<almond host>:32000
```

### Troubleshooting

You may see an error, 'access forbidden by rule', output in nginx logs, as in example below;
which IP 10.1.12.1 is my kubenetes instance and my host 192.168.0.2.

```logs

2021/03/06 10:06:18 [error] 31#31: *1 access forbidden by rule, client: 10.1.12.1, server: _, request: "GET / HTTP/1.1", host: "192.168.0.2:32000"
10.1.12.1 - - [06/Mar/2021:10:06:18 +0000] "GET / HTTP/1.1" 403 125 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15"
2021/03/06 10:06:18 [error] 31#31: *2 access forbidden by rule, client: 10.1.12.1, server: _, request: "GET /favicon.ico HTTP/1.1", host: "192.168.0.2:32000", referrer: "http://192.168.0.2:32000/"
10.1.12.1 - - [06/Mar/2021:10:06:18 +0000] "GET /favicon.ico HTTP/1.1" 403 125 "http://192.168.0.2:32000/" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15"

```

Update the configmap to allow client 10.1.12.1, e.g.

```yaml

allow   127.0.0.1;  # localhost
allow   10.1.12.1;  # kubernetes
deny    all;

```

Restart Nginx container.
You are good to go.