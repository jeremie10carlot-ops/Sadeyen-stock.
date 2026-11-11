# Sadeyen Stock — tâches et rappels iPhone

## Fonctionnalités actives
- Ma journée : Aujourd'hui, 7 jours, À venir, Terminées.
- Tâches partagées dans Firebase Realtime Database, indépendantes de l'inventaire.
- Tâches personnelles conservées uniquement sur l'iPhone.
- Priorité, responsable, événement, checklist et répétition quotidienne, hebdomadaire ou mensuelle.
- Résumé des tâches du jour, sauvegarde incluant les tâches privées.
- Installation PWA et demande de permission des notifications.

IMPORTANT : les notifications lorsque l'application est fermée nécessitent aussi un émetteur distant. Le code est prêt dans scripts/send-reminders.mjs et .github/workflows/sadeyen-reminders.yml. Il faut activer les deux secrets GitHub ci-dessous. Les déclenchements programmés de GitHub Actions peuvent être retardés ou omis : ne pas les utiliser comme alarme pour une obligation à l'heure exacte.

## Activer les notifications sans abonnement

Le dépôt GitHub est public. L'utilisation normale de GitHub Actions sur un dépôt public est gratuite sous réserve des limites de GitHub, et Firebase Spark dispose de quotas gratuits.

### 1. Clé serveur Firebase (PRIVÉE)

Dans Firebase Console → Paramètres du projet → Comptes de service → Firebase Admin SDK :
- Idéalement créer un compte de service dédié avec seulement les permissions nécessaires à la Realtime Database.
- Générer une nouvelle clé privée JSON et télécharger le fichier.
- NE JAMAIS envoyer ce JSON dans ChatGPT, dans un message ou dans un fichier du dépôt.
- GitHub → dépôt Sadeyen-stock. → Settings → Secrets and variables → Actions → New repository secret.
- Nom exact du secret : FIREBASE_SERVICE_ACCOUNT_JSON
- Valeur : le contenu COMPLET du JSON de la clé privée téléchargée.

ATTENTION : ce secret permet à la tâche serveur de lire/écrire dans la base de données, indépendamment des règles des utilisateurs. Il doit rester confidentiel.

### 2. Clé privée des notifications Web Push

- Télécharger le fichier privé sadeyen_push_private_key.txt fourni dans ChatGPT.
- Copier seulement la valeur de la ligne VAPID_PRIVATE_KEY=, sans le nom.
- Dans GitHub, ajouter un deuxième repository secret : VAPID_PRIVATE_KEY
- NE JAMAIS ajouter cette valeur dans le code source public.
- La clé publique correspondante est déjà intégrée à push.js et scripts/send-reminders.mjs.

### 3. Activer et tester les rappels

Après avoir configuré les deux secrets :
- Dans GitHub → Settings → Secrets and variables → Actions → onglet Variables → New repository variable.
- Nom exact : PUSH_ENABLED ; valeur : true.
- Sans cette variable, le planificateur ne démarre pas et aucun secret n’est utilisé.
- Puis GitHub → Actions → Rappels Sadeyen Stock → Run workflow.
- Une exécution verte indique que le serveur fonctionne.
- Le workflow est demandé toutes les 5 minutes (non garanti à la minute).
- L'application affiche « Planificateur en fonctionnement » si la dernière exécution date de moins d'une heure.

### 4. Sur chaque iPhone

1. Télécharger une sauvegarde avant toute réinstallation.
2. Installer Sadeyen Stock depuis Safari via Partager → Sur l'écran d'accueil, puis ouvrir l'icône.
3. Se connecter à Firebase avec le compte autorisé.
4. Dans Ma journée, toucher « Je suis » pour définir son prénom, identique au prénom utilisé dans l'attribution des tâches.
5. Toucher « Activer les rappels iPhone », puis autoriser les notifications.
6. La notification test confirme la permission locale. Le test d'un vrai rappel après une exécution de GitHub Actions vérifie l'envoi à distance.

Sur iPhone, le Web Push nécessite iOS 16.4+ et une application ajoutée à l'écran d'accueil. Une ancienne icône installée avant le manifest peut nécessiter une nouvelle installation : sauvegarder les données privées avant.

## Confidentialité

Les deux personnes utilisent actuellement le MÊME compte Firebase.
- Les tâches partagées sont visibles des deux iPhone.
- Les titres des tâches privées sont conservés seulement sur le téléphone créateur.
- Pour les rappels privés, le serveur reçoit seulement un horaire et un identifiant technique : le texte de la tâche reste privé, et la notification est générique.
- Les tâches privées ne sont pas synchronisées sur un autre iPhone : les sauvegarder.
- Deux comptes séparés seraient préférables à terme pour savoir qui a modifié quoi.

## Limites
- Modifier simultanément la même tâche peut provoquer une dernière écriture gagnante.
- Les rappels via GitHub Actions peuvent être retardés ou ratés : utiliser une alarme native pour les tâches à l'heure critique.
- Google Agenda n'est pas synchronisé automatiquement.
