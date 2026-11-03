# OCR assets

Tesseract.js 7.0.0 and tesseract.js-core 7.0.0 are redistributed with their Apache-2.0 license files in the adjacent package directories. Only the LSTM core pair is needed by this app; other downloaded variants are excluded from the release package.

Thai and English 4.0.0_best_int trained data are pinned to @tesseract.js-data/tha and @tesseract.js-data/eng 1.0.0. The upstream trained-data models are derived from tessdata_best (Apache-2.0); its license is included in languages/LICENSE. The npm distribution wrappers declare MIT metadata and contain no separate license file in their package archives. No wrapper build scripts are used in the app. See https://github.com/naptha/tessdata and https://github.com/tesseract-ocr/tessdata_best for provenance.

Package archives were checked against npm's SHA-512 integrity metadata. manifest.json records downloaded file hashes, sizes and sources; the release manifest lists only shipped files. Models and runtime are hosted with the app; recognition does not call an inference service. Original Google Fonts links provide typography as in the approved UI.
