# Synthetic Attack Demonstration

Use `synthetic_deepfake_attack_demo.avi` as an OBS **Media Source**. This is a 9.73-second looping MJPEG video of a completely fictional AI-generated identity.

## Sequence

- Neutral face
- Both eyes closed for the blink challenge
- Neutral reset
- Head turned approximately 35 degrees
- Neutral reset
- Broad smile
- Neutral reset

## OBS

1. Select the `DeepFake Test` scene.
2. Open the `Media` source properties.
3. Enable **Local File** and browse to `synthetic_deepfake_attack_demo.avi`.
4. Enable **Loop** and disable hardware decoding if the preview remains black.
5. Right-click the preview and choose **Transform > Fit to Screen**.
6. Start the OBS Virtual Camera.
7. Select OBS Virtual Camera in the browser and run DeepGuard verification.

The video may begin partway through the sequence. Because it loops, leave verification running until the blink, turn, and smile challenges have each appeared in the required order.

This asset is for a defensive graduation-project demonstration only. It does not depict a real or identifiable person.

## Guided liveness sequence

`synthetic_liveness_steps_demo.mp4` and `synthetic_liveness_steps_demo.avi` follow the current fixed verification flow and keep a labelled seven-step guide visible:

1. Blink
2. Center
3. Turn right
4. Turn left
5. Recenter
6. Move closer
7. Smile

Use the MP4 as the OBS Media Source when possible. The AVI is an MJPEG fallback. Enable **Loop** before starting the OBS Virtual Camera.
