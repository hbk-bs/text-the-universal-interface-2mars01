# KI-Debattierclub: Automatisierte Text-Debatten

Dieses Projekt ist eine kleine Webanwendung, die humorvolle, automatisch ablaufende Text-Debatten zwischen einer KI und einer simulierten Gegenrolle generiert.

## Funktionsweise

1.  **Themenauswahl:** Der Benutzer wählt aus einer Liste von (eher albernen) Debattenthemen.
2.  **Automatischer Chat:** Sobald ein Thema gewählt ist, startet ein Chat, der in regelmäßigen Intervallen fortgesetzt wird.
    *   Eine KI generiert Antworten.
    *   Um einen Dialogfluss zu erzeugen, wird die Rolle für die KI-Anfrage intern nach jeder Antwort getauscht (die KI antwortet quasi auf ihre vorherige Aussage aus einer anderen Perspektive).
    *   Die visuelle Darstellung der Chatblasen bleibt jedoch konsistent (z.B. KI immer links, initiale Anfrage immer rechts), dank einer separaten `displayRole`.
3.  **Neues Thema:** Ein Button ermöglicht es dem Benutzer, den aktuellen Chat zu stoppen und ein neues Thema auszuwählen.
4.  **(Geplant/Optional) Moderator:** Das System ist so vorbereitet, dass nach einer bestimmten Anzahl von Redebeiträgen ein KI-Moderator die Debatte zusammenfassen könnte.

## Kerntechnologien

*   **Frontend:** HTML, CSS, JavaScript
*   **KI-Interaktion:** Kommunikation mit einem externen KI-Endpunkt (z.B. via `fetch` API) zur Generierung der Debattenbeiträge.
*   **Dynamische UI:** JavaScript manipuliert das DOM, um Themen, Chat-Nachrichten und Steuerelemente anzuzeigen.

## Besonderheiten

*   Automatisierter Dialog durch internen Rollentausch.
*   Konsistente visuelle Darstellung der Sprecher trotz Rollentausch.
*   Fokus auf unterhaltsame, leicht absurde Debatten.
[0]: https://brightsky.dev/
[1]: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API/Using_the_Geolocation_API