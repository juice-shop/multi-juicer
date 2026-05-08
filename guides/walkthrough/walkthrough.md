# MultiJuicer Walkthrough

A quick visual tour of how participants join a MultiJuicer event and what hosts see during one.

## 1. Registration

Participants open the MultiJuicer URL and pick a team name. Existing team members can join with a passcode; new teams get one generated for them.

![MultiJuicer registration screen with a text field for the team name and a "Create / Join Team" button. The page is titled "MultiJuicer" and explains that participants need a team to start a JuiceShop instance.](../../images/screenshots/user-flow-1-registration.webp)

## 2. Instance starting

After joining, MultiJuicer spins up a dedicated JuiceShop instance for the team. The user sees a waiting screen until the pod is ready (usually a few seconds, depending on the speed of underlying CPU and wheater the node already has the Juice Shop image cached).

![MultiJuicer "Instance is starting" screen showing a loading indicator and a message that the JuiceShop instance is being prepared for the team.](../../images/screenshots/user-flow-2-starting-instance.webp)

## 3. What happens behind the scenes

Under the hood MultiJuicer creates a separate Kubernetes Deployment per team. Admins can inspect them directly with `kubectl`:

![Terminal output of "kubectl get deployments" showing a juice-shop deployment for the newly created team alongside the multi-juicer system deployments, with READY, UP-TO-DATE, AVAILABLE and AGE columns.](../../images/screenshots/user-flow-3-instance-starting-kubernetes.webp)

## 4. Instance ready

Once the pod is up the waiting screen flips to a "ready" state with a **Start Hacking** button. Clicking it sends the participant to their personal JuiceShop.

![MultiJuicer instance status screen showing the JuiceShop instance as ready, with a green status indicator and a prominent "Start Hacking" button that takes the participant to their JuiceShop.](../../images/screenshots/user-flow-4-finished-logging-in-instance-status.webp)

## 5. Playing JuiceShop

After clicking **Start Hacking** the participant lands in their personal JuiceShop. From here on they use JuiceShop normally — the MultiJuicer LoadBalancer transparently routes their traffic to the right instance.

![OWASP Juice Shop landing page rendered inside the participant's instance, showing the product catalog with apple juice, banana juice and other items, plus the JuiceShop navigation bar at the top.](../../images/screenshots/user-flow-5-finished-logging-in-using-juiceshop.webp)

## Scoreboard

The scoreboard lists every team and their solved-challenge progress. Useful during the event so participants can compare standings. The ScoreBoard also allows for detail pages for challenges and teams, to see which teams have solved which challenges.

![MultiJuicer scoreboard listing three teams in a leaderboard table, each row showing the team name, the number of solved challenges and the score.](../../images/screenshots/user-flow-6-regular-scoreboard.webp)

## CTF / projector view

The CTF view is primarily meant for in-person events, something to put on a projector for some additional visual eye candy and to spread some hacker vibes.

![MultiJuicer CTF projector view showing the top teams in a large, high-contrast layout suitable for a screen at the front of the room during a live CTF event.](../../images/screenshots/user-flow-7-ctf-view.webp)

## Admin interface

Hosts get a dedicated admin page to manage the running event: list all team instances, restart or delete them, reset team passcodes, broadcast a notification message to every participant and set an end date for the event.

![MultiJuicer admin interface listing all team instances with controls to restart, delete and reset passcodes, plus inputs for broadcasting a notification message to all participants and setting an event end date.](../../images/screenshots/user-flow-8-admin.webp)
