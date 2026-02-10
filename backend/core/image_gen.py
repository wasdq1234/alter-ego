"""Replicate LoRA training and image generation module."""

import os
import uuid

import httpx
import replicate

from core.supabase_client import get_supabase

BUCKET = "persona-images"

# Flux dev LoRA trainer on Replicate
LORA_TRAINER_MODEL = "ostris/flux-dev-lora-trainer"
LORA_TRAINER_VERSION = (
    "d995297071a44dcb72244e6c19462f9670cb8a5632df8e2d8e583f8688e4b7e5"
)

# Flux dev model for inference with LoRA weights
FLUX_DEV_MODEL = "black-forest-labs/flux-dev"


async def start_lora_training(
    *,
    input_images_url: str,
    trigger_word: str,
    destination_model: str,
    steps: int = 1000,
    webhook_url: str | None = None,
) -> dict:
    """Start a LoRA fine-tuning job on Replicate.

    Args:
        input_images_url: URL to a zip file of training images.
        trigger_word: The trigger word to associate with the trained concept.
        destination_model: Replicate model destination (e.g. "username/model-name").
        steps: Number of training steps (default 1000).
        webhook_url: Optional webhook URL for training completion notification.

    Returns:
        dict with training id, status, and model destination.
    """
    training_input = {
        "input_images": input_images_url,
        "trigger_word": trigger_word,
        "steps": steps,
        "autocaption": True,
        "resolution": "512,768,1024",
        "batch_size": 1,
        "learning_rate": 0.0004,
    }

    kwargs = {
        "model": LORA_TRAINER_MODEL,
        "version": LORA_TRAINER_VERSION,
        "input": training_input,
        "destination": destination_model,
    }
    if webhook_url:
        kwargs["webhook"] = webhook_url
        kwargs["webhook_events_filter"] = ["completed"]

    training = replicate.trainings.create(**kwargs)

    return {
        "training_id": training.id,
        "status": training.status,
        "model": destination_model,
    }


async def get_training_status(training_id: str) -> dict:
    """Check the status of a LoRA training job.

    Args:
        training_id: The Replicate training ID.

    Returns:
        dict with training id, status, logs (last 500 chars), and version if succeeded.
    """
    training = replicate.trainings.get(training_id)

    result = {
        "training_id": training.id,
        "status": training.status,
        "logs": (training.logs or "")[-500:],
    }

    if training.status == "succeeded" and training.output:
        result["version"] = training.output.get("version")

    return result


async def generate_lora_image(
    *,
    lora_model: str,
    prompt: str,
    num_outputs: int = 1,
    guidance_scale: float = 3.5,
    num_inference_steps: int = 28,
    output_format: str = "png",
) -> list[str]:
    """Generate images using a trained LoRA model.

    Args:
        lora_model: The trained LoRA model identifier on Replicate.
        prompt: Text prompt for image generation (should include trigger word).
        num_outputs: Number of images to generate.
        guidance_scale: How closely to follow the prompt.
        num_inference_steps: Number of denoising steps.
        output_format: Output image format.

    Returns:
        List of image URLs from Replicate.
    """
    output = await replicate.async_run(
        FLUX_DEV_MODEL,
        input={
            "prompt": prompt,
            "num_outputs": num_outputs,
            "guidance": guidance_scale,
            "num_inference_steps": num_inference_steps,
            "output_format": output_format,
            "lora_weights": lora_model,
        },
    )

    # output is a list of FileOutput objects; extract URLs
    image_urls = []
    for item in output:
        if hasattr(item, "url"):
            image_urls.append(str(item.url))
        else:
            image_urls.append(str(item))

    return image_urls


async def upload_image_to_storage(
    image_url: str,
    persona_id: str,
    user_id: str,
) -> dict:
    """Download an image from URL and upload to Supabase Storage.

    Args:
        image_url: URL of the generated image to download.
        persona_id: The persona this image belongs to.
        user_id: The owner user ID.

    Returns:
        dict with file_path and public_url.
    """
    async with httpx.AsyncClient() as http:
        resp = await http.get(image_url)
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to download image: HTTP {resp.status_code}")
        image_bytes = resp.content

    sb = get_supabase()
    file_id = str(uuid.uuid4())
    file_path = f"images/{file_id}.png"

    sb.storage.from_(BUCKET).upload(
        path=file_path,
        file=image_bytes,
        file_options={"content-type": "image/png", "upsert": "false"},
    )

    public_url = sb.storage.from_(BUCKET).get_public_url(file_path)

    return {
        "file_path": file_path,
        "public_url": public_url,
    }
