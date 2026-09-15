# Méthode de Bypass Multi-Instance Roblox sur macOS (Hyperion/Byfron)

## Le Problème
Depuis l'ajout de l'anti-cheat Hyperion (Byfron) sur macOS et les mises à jour récentes du client, la méthode classique de multi-instancing (qui consistait à détruire le sémaphore POSIX `/RobloxPlayerUniq`) ne fonctionne plus. 
Roblox a renforcé ses vérifications :
1. **LaunchServices & Bundle ID** : macOS empêche par défaut d'ouvrir deux fois la même application (même Bundle ID).
2. **Conflits de Caches/Cookies** : Deux instances partageant le même dossier `$HOME/Library/...` (notamment `appStorage.json` ou `binarycookies`) entrent en conflit. La deuxième instance écrase les cookies de la première, provoquant une déconnexion silencieuse ou une "Error 773".

## La Solution : Isolation Totale (Sandbox Native)

Pour contourner ces restrictions sans injecter de code et risquer un ban, nous utilisons une isolation parfaite basée sur les principes natifs de macOS.

### Les 5 étapes du lancement :

1. **Clonage de l'Application (Zéro octet supplémentaire grâce à APFS !)**
   À chaque lancement d'une nouvelle session, l'application originale (`/Applications/Roblox.app`) est copiée vers un dossier temporaire dédié (`/tmp/Roblox_Session_123.app`).
   *Astuce technique :* Nous utilisons la commande `cp -cR`. Sur le système de fichiers macOS (APFS), l'option `-c` crée un **clone (Copy-on-Write)**. Cela signifie que faire 10 copies du jeu de 400 Mo prend **0 octet** d'espace disque supplémentaire ! Seuls les fichiers que nous modifions (comme `Info.plist`) consomment de l'espace (quelques kilooctets).

2. **Création d'un Faux Dossier Utilisateur (Persistant)**
   On crée un dossier dédié dans les données de l'application (ex: `~/Library/Application Support/Bloxfruit Manager/Instances/Home_123`). En forçant l'application Roblox clonée à croire que c'est son dossier utilisateur principal, elle y stockera ses propres caches, logs et cookies.
   *Note :* Ce dossier est **persistant**. Ainsi, les paramètres graphiques et le volume sonore de cette session Roblox sont conservés entre les redémarrages. Quand tu supprimes la session dans le manager, ce dossier est proprement supprimé !

3. **Suppression de l'Installateur Interne (La Pièce Maîtresse)**
   À l'intérieur de l'application Roblox, il y a un sous-programme (`RobloxPlayerInstaller.app`). À chaque lancement, le jeu l'exécute pour vérifier les mises à jour. C'est lui qui cause tous les problèmes (il utilise un verrou global "Another Installer is running" et il lance le Roblox principal, tuant les autres instances).
   La solution magique : **Nous supprimons purement et simplement cet installateur de notre clone !** Le jeu, ne le trouvant pas, abandonne la vérification des mises à jour et se lance instantanément.

4. **Lancement Isolé Direct (Bypass de LaunchServices)**
   Plutôt que d'utiliser la commande classique `open` de macOS (qui passe par `LaunchServices` et nécessite de casser la signature de l'application), nous exécutons **directement le binaire brut** caché dans l'application :
   `env HOME=/tmp/RobloxHome_123 /tmp/Roblox_Session_123.app/Contents/MacOS/RobloxPlayer "roblox-player://..."`
   Cela force le jeu à se lancer immédiatement et préserve 100% de sa signature Apple d'origine (donc aucune erreur de trousseau d'accès).
- **100% Sûr (Pas de Ban)** : On ne modifie pas les binaires, la mémoire, ou les mutex du jeu. On joue simplement avec l'écosystème macOS.
- **Sessions multiples illimitées** : Chaque compte possède sa propre bulle hermétique.
- **Stabilité** : Aucune déconnexion croisée car les cookies (LocalStorage) sont physiquement séparés sur le disque.
